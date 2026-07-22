import type { LlmEngine, LlmSettings } from '@core/generation/engine';
import { MockAdapter } from './mock';
import { OllamaAdapter } from './ollama';
import { OpenRouterAdapter } from './openrouter';

export function createEngine(settings: LlmSettings): LlmEngine {
  switch (settings.activeProvider) {
    case 'ollama':
      return new OllamaAdapter(settings.ollama.baseUrl, settings.ollama.model);
    case 'openrouter':
      return new OpenRouterAdapter(
        settings.openrouter.baseUrl,
        settings.openrouter.apiKey,
        settings.openrouter.model,
      );
    case 'mock':
      return new MockAdapter();
  }
}

/** True when the settings are complete enough to generate content. */
export function isEngineConfigured(settings: LlmSettings): boolean {
  switch (settings.activeProvider) {
    case 'ollama':
      return settings.ollama.baseUrl.length > 0 && settings.ollama.model.length > 0;
    case 'openrouter':
      return (
        settings.openrouter.baseUrl.length > 0 &&
        settings.openrouter.apiKey.length > 0 &&
        settings.openrouter.model.length > 0
      );
    case 'mock':
      return true;
  }
}
