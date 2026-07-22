/**
 * Provider-agnostic LLM engine contract. The core builds CompletionRequests;
 * adapters in the main process implement the wire protocols.
 */
import { z } from 'zod';
import type { JobType } from './jobs';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  /** Job type that produced this request (labels, logging, MockAdapter routing). */
  tag: JobType;
  system: string;
  messages: ChatTurn[];
  temperature: number;
  maxOutputTokens: number;
  /** Hint that the response must be a single JSON object. */
  expectJson: boolean;
}

export interface CompletionResult {
  text: string;
}

export interface ModelInfo {
  id: string;
  /** Optional human-readable label (falls back to id). */
  name?: string;
}

export type ProviderId = 'ollama' | 'openrouter' | 'mock';

export interface LlmEngine {
  readonly providerId: ProviderId;
  listModels(): Promise<ModelInfo[]>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
  complete(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult>;
}

export const llmSettingsSchema = z.object({
  activeProvider: z.enum(['ollama', 'openrouter', 'mock']),
  ollama: z.object({
    baseUrl: z.string(),
    model: z.string(),
  }),
  openrouter: z.object({
    baseUrl: z.string(),
    apiKey: z.string(),
    model: z.string(),
  }),
});
export type LlmSettings = z.infer<typeof llmSettingsSchema>;

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  activeProvider: 'ollama',
  ollama: { baseUrl: 'http://localhost:11434', model: '' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', model: '' },
};

/** Models surfaced as suggested picks in the model list UI. */
export const RECOMMENDED_MODELS: Record<'ollama' | 'openrouter', string[]> = {
  ollama: ['llama3.1:8b', 'qwen2.5:7b-instruct'],
  openrouter: [
    'meta-llama/llama-3.1-8b-instruct',
    'anthropic/claude-haiku-4.5',
    'qwen/qwen-2.5-7b-instruct',
  ],
};
