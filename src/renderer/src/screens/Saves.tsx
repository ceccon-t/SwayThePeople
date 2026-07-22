/**
 * Save/Load screen. One screen, two modes (screen.savesMode): "save" offers a
 * name form plus per-slot Overwrite buttons; "load" offers per-slot Load
 * buttons. Delete is available in both.
 */
import { useCallback, useEffect, useState } from 'react';
import type { SaveInfo } from '@core/protocol';
import { invoke } from '../api';
import { Section } from '../components/common';
import { useStore } from '../store';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function Saves(): JSX.Element {
  const { campaign, screen, navigate, showError } = useStore();
  const [saves, setSaves] = useState<SaveInfo[]>([]);
  const [name, setName] = useState('');
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const mode = screen.savesMode ?? (campaign ? 'save' : 'load');

  const refresh = useCallback(async () => {
    const reply = await invoke('saves.list');
    if (reply.ok) setSaves(reply.data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (campaign && !name) {
      const player = campaign.candidates.find((c) => c.id === campaign.playerCandidateId);
      setName(player ? `${player.name} campaign` : 'My campaign');
    }
  }, [campaign, name]);

  const save = async (saveName: string): Promise<void> => {
    const reply = await invoke('campaign.save', { name: saveName });
    if (!reply.ok) {
      showError(reply.error);
      return;
    }
    setSavedAs(saveName);
    await refresh();
  };

  const load = async (fileName: string): Promise<void> => {
    const reply = await invoke('campaign.load', { fileName });
    if (!reply.ok) {
      showError(reply.error);
      return;
    }
    navigate({
      name:
        reply.data.phase === 'setup'
          ? 'wizard'
          : reply.data.phase === 'finished'
            ? 'election'
            : 'hub',
    });
  };

  const remove = async (fileName: string): Promise<void> => {
    const reply = await invoke('campaign.delete', { fileName });
    if (!reply.ok) showError(reply.error);
    await refresh();
  };

  return (
    <div className="saves-screen">
      {mode === 'save' && campaign && (
        <Section title="Save current campaign">
          <div className="save-form">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Save name"
            />
            <button className="btn primary" disabled={!name.trim()} onClick={() => void save(name)}>
              Save
            </button>
          </div>
          <p className="muted">
            {savedAs
              ? `✓ Saved as “${savedAs}”.`
              : 'Saving with an existing name overwrites that slot — or use Overwrite below.'}
          </p>
        </Section>
      )}
      <Section title="Saved campaigns">
        {saves.length === 0 && <p className="muted">No saved campaigns yet.</p>}
        <ul className="save-list">
          {saves.map((info) => (
            <li key={info.fileName} className="save-item">
              <div className="save-meta">
                <strong>{info.name}</strong>
                <span className="muted">
                  {info.candidateName} · {info.partyName} · day {info.day} ({info.phase}) ·{' '}
                  {new Date(info.savedAt).toLocaleString()} · {formatSize(info.sizeBytes)}
                </span>
              </div>
              <div className="save-actions">
                {mode === 'save' && campaign ? (
                  <button className="btn small primary" onClick={() => void save(info.name)}>
                    Overwrite
                  </button>
                ) : (
                  <button className="btn small primary" onClick={() => void load(info.fileName)}>
                    Load
                  </button>
                )}
                <button className="btn small danger" onClick={() => void remove(info.fileName)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
