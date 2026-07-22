import type {
  CompletionRequest,
  CompletionResult,
  LlmEngine,
  ModelInfo,
} from '@core/generation/engine';
import { estimateTokens } from '@core/generation/budget';

const LIST_TIMEOUT_MS = 10_000;
/**
 * Local generation can legitimately take minutes (CPU prompt eval before the
 * first token, then slow token-by-token output). A fixed overall deadline
 * kills healthy runs and makes failures look like freezes, so instead we
 * stream and abort only when the connection goes silent for this long.
 */
const IDLE_TIMEOUT_MS = 300_000;
/** Keep the model loaded between the many back-to-back queue jobs. */
const KEEP_ALIVE = '15m';
/**
 * Ollama defaults num_ctx to ~4K, silently truncating our prompts (budgeted
 * up to ~12K input tokens) — which yields degenerate JSON and wasted retries.
 * Size the context to the request, bounded to keep memory use sane.
 */
const NUM_CTX_MIN = 4096;
const NUM_CTX_MAX = 16384;

interface StreamChunk {
  message?: { content?: string };
  error?: string;
  done?: boolean;
}

export class OllamaAdapter implements LlmEngine {
  readonly providerId = 'ollama' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`;
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await fetch(this.url('/api/tags'), {
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Ollama responded ${response.status}`);
    const data = (await response.json()) as { models?: Array<{ name: string }> };
    return (data.models ?? []).map((m) => ({ id: m.name }));
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const models = await this.listModels();
      if (this.model && !models.some((m) => m.id === this.model)) {
        return { ok: false, message: `Connected, but model "${this.model}" is not installed.` };
      }
      return { ok: true, message: `Connected — ${models.length} model(s) available.` };
    } catch (error) {
      return { ok: false, message: `Cannot reach Ollama: ${(error as Error).message}` };
    }
  }

  private contextSize(request: CompletionRequest): number {
    const promptTokens =
      estimateTokens(request.system) +
      request.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const needed = promptTokens + request.maxOutputTokens + 512;
    const rounded = Math.ceil(needed / 1024) * 1024;
    return Math.min(NUM_CTX_MAX, Math.max(NUM_CTX_MIN, rounded));
  }

  async complete(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
    const controller = new AbortController();
    const abortUpstream = (): void => controller.abort();
    signal?.addEventListener('abort', abortUpstream, { once: true });
    let stalled = false;
    let watchdog = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, IDLE_TIMEOUT_MS);
    const resetWatchdog = (): void => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        stalled = true;
        controller.abort();
      }, IDLE_TIMEOUT_MS);
    };

    try {
      const response = await fetch(this.url('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          keep_alive: KEEP_ALIVE,
          format: request.expectJson ? 'json' : undefined,
          options: {
            temperature: request.temperature,
            num_predict: request.maxOutputTokens,
            num_ctx: this.contextSize(request),
          },
          messages: [
            { role: 'system', content: request.system },
            ...request.messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.text().catch(() => '');
        throw new Error(`Ollama responded ${response.status}: ${body.slice(0, 200)}`);
      }

      // NDJSON stream: one chunk per line, `done: true` on the last.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      const consume = (line: string): void => {
        if (!line.trim()) return;
        const chunk = JSON.parse(line) as StreamChunk;
        if (chunk.error) throw new Error(`Ollama error: ${chunk.error}`);
        text += chunk.message?.content ?? '';
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        resetWatchdog();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) consume(line);
      }
      consume(buffer);

      if (!text) throw new Error('Ollama returned an empty response');
      return { text };
    } catch (error) {
      if (stalled) {
        throw new Error(
          `Ollama stalled: no data received for ${IDLE_TIMEOUT_MS / 1000}s (is the model still loading or the machine overloaded?)`,
        );
      }
      throw error;
    } finally {
      clearTimeout(watchdog);
      signal?.removeEventListener('abort', abortUpstream);
    }
  }
}
