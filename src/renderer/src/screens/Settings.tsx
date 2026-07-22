import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LLM_SETTINGS,
  RECOMMENDED_MODELS,
  type LlmSettings,
  type ModelInfo,
  type ProviderId,
} from '@core/generation/engine';
import { invoke } from '../api';
import { Section, Spinner } from '../components/common';
import { useStore } from '../store';

export function isEngineConfiguredView(settings: LlmSettings): boolean {
  switch (settings.activeProvider) {
    case 'ollama':
      return Boolean(settings.ollama.baseUrl && settings.ollama.model);
    case 'openrouter':
      return Boolean(
        settings.openrouter.baseUrl && settings.openrouter.apiKey && settings.openrouter.model,
      );
    case 'mock':
      return true;
  }
}

/** Filterable model picker: the list always comes from the provider's API. */
function ModelPicker({
  models,
  value,
  recommended,
  loading,
  onChange,
  onRefresh,
}: {
  models: ModelInfo[] | null;
  value: string;
  recommended: string[];
  loading: boolean;
  onChange: (model: string) => void;
  onRefresh: () => void;
}): JSX.Element {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    if (!models) return [];
    const needle = filter.trim().toLowerCase();
    const matches = needle
      ? models.filter(
          (m) => m.id.toLowerCase().includes(needle) || m.name?.toLowerCase().includes(needle),
        )
      : models;
    // Recommended picks float to the top.
    return [...matches].sort(
      (a, b) => Number(recommended.includes(b.id)) - Number(recommended.includes(a.id)),
    );
  }, [models, filter, recommended]);

  return (
    <div className="model-picker">
      <div className="model-picker-head">
        <input
          type="text"
          placeholder="Type to filter models (e.g. llama)…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="btn small" onClick={onRefresh} disabled={loading}>
          {loading ? <Spinner /> : 'Refresh list'}
        </button>
      </div>
      {models === null && !loading && (
        <p className="muted">Load the model list to choose a model.</p>
      )}
      {models !== null && filtered.length === 0 && !loading && (
        <p className="muted">No models match “{filter}”.</p>
      )}
      <ul className="model-list">
        {filtered.slice(0, 60).map((model) => (
          <li key={model.id}>
            <button
              className={`model-option ${model.id === value ? 'selected' : ''}`}
              onClick={() => onChange(model.id)}
            >
              <span>
                {model.name && model.name !== model.id ? `${model.name} — ${model.id}` : model.id}
              </span>
              {recommended.includes(model.id) && <span className="badge">recommended</span>}
            </button>
          </li>
        ))}
      </ul>
      {value && (
        <p className="model-current">
          Selected: <strong>{value}</strong>
        </p>
      )}
    </div>
  );
}

export function Settings(): JSX.Element {
  const { settings, refreshSettings, navigate, showError } = useStore();
  const [draft, setDraft] = useState<LlmSettings>(settings ?? DEFAULT_LLM_SETTINGS);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const provider = draft.activeProvider;

  const setProvider = (p: ProviderId): void => {
    setDraft({ ...draft, activeProvider: p });
    setModels(null);
    setTestResult(null);
  };

  const loadModels = async (): Promise<void> => {
    setLoadingModels(true);
    setModels(null);
    const reply = await invoke('llm.listModels', draft);
    setLoadingModels(false);
    if (reply.ok) setModels(reply.data);
    else showError(reply.error);
  };

  const test = async (): Promise<void> => {
    setTestResult(null);
    const reply = await invoke('llm.test', draft);
    if (reply.ok) setTestResult(reply.data);
    else setTestResult({ ok: false, message: reply.error });
  };

  const save = async (): Promise<void> => {
    const reply = await invoke('settings.setLlm', draft);
    if (!reply.ok) {
      showError(reply.error);
      return;
    }
    await refreshSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="settings-screen">
      <Section title="AI Engine">
        <p className="muted">
          The game generates its world, characters and debates with the engine you configure here.
          You can change this at any time — even mid-campaign.
        </p>
        <div className="provider-tabs">
          {(['ollama', 'openrouter', 'mock'] as const).map((p) => (
            <button
              key={p}
              className={`provider-tab ${provider === p ? 'active' : ''}`}
              onClick={() => setProvider(p)}
            >
              {p === 'ollama'
                ? 'Ollama (local)'
                : p === 'openrouter'
                  ? 'OpenRouter (API)'
                  : 'Mock (offline demo)'}
            </button>
          ))}
        </div>

        {provider === 'ollama' && (
          <div className="settings-fields">
            <label>
              Server URL
              <input
                type="text"
                value={draft.ollama.baseUrl}
                onChange={(e) =>
                  setDraft({ ...draft, ollama: { ...draft.ollama, baseUrl: e.target.value } })
                }
              />
            </label>
            <label className="field-label">Model</label>
            <ModelPicker
              models={models}
              value={draft.ollama.model}
              recommended={RECOMMENDED_MODELS.ollama}
              loading={loadingModels}
              onChange={(model) => setDraft({ ...draft, ollama: { ...draft.ollama, model } })}
              onRefresh={() => void loadModels()}
            />
          </div>
        )}

        {provider === 'openrouter' && (
          <div className="settings-fields">
            <label>
              API base URL
              <input
                type="text"
                value={draft.openrouter.baseUrl}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    openrouter: { ...draft.openrouter, baseUrl: e.target.value },
                  })
                }
              />
            </label>
            <label>
              API key
              <input
                type="password"
                value={draft.openrouter.apiKey}
                placeholder="sk-or-…"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    openrouter: { ...draft.openrouter, apiKey: e.target.value },
                  })
                }
              />
            </label>
            <label className="field-label">Model</label>
            <ModelPicker
              models={models}
              value={draft.openrouter.model}
              recommended={RECOMMENDED_MODELS.openrouter}
              loading={loadingModels}
              onChange={(model) =>
                setDraft({ ...draft, openrouter: { ...draft.openrouter, model } })
              }
              onRefresh={() => void loadModels()}
            />
          </div>
        )}

        {provider === 'mock' && (
          <p className="muted">
            The Mock engine plays fully offline with canned (but coherent) content — useful to try
            the game's flow without a model.
          </p>
        )}

        <div className="settings-actions">
          <button className="btn" onClick={() => void test()}>
            Test connection
          </button>
          <button className="btn primary" onClick={() => void save()}>
            Save settings
          </button>
          {saved && <span className="save-ok">✓ Saved</span>}
          <button className="btn ghost" onClick={() => navigate({ name: 'menu' })}>
            Back
          </button>
        </div>
        {testResult && (
          <p className={testResult.ok ? 'test-ok' : 'test-fail'}>{testResult.message}</p>
        )}
      </Section>
    </div>
  );
}
