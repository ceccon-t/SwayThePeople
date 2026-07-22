import type {
  CompletionRequest,
  CompletionResult,
  LlmEngine,
  ModelInfo,
} from '@core/generation/engine';

const LIST_TIMEOUT_MS = 15_000;
const COMPLETE_TIMEOUT_MS = 180_000;

export class OpenRouterAdapter implements LlmEngine {
  readonly providerId = 'openrouter' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Sway The People!',
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await fetch(this.url('/models'), {
      headers: this.headers(),
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`OpenRouter responded ${response.status}`);
    const data = (await response.json()) as { data?: Array<{ id: string; name?: string }> };
    return (data.data ?? []).map((m) => ({ id: m.id, name: m.name }));
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.apiKey) return { ok: false, message: 'An API key is required for OpenRouter.' };
    try {
      const models = await this.listModels();
      return { ok: true, message: `Connected — ${models.length} model(s) listed.` };
    } catch (error) {
      return { ok: false, message: `Cannot reach OpenRouter: ${(error as Error).message}` };
    }
  }

  async complete(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
    const response = await fetch(this.url('/chat/completions'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens,
        response_format: request.expectJson ? { type: 'json_object' } : undefined,
        messages: [
          { role: 'system', content: request.system },
          ...request.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
      signal: signal ?? AbortSignal.timeout(COMPLETE_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenRouter responded ${response.status}: ${body.slice(0, 200)}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('OpenRouter returned an empty response');
    return { text };
  }
}
