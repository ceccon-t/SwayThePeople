import { contextBridge, ipcRenderer } from 'electron';

/**
 * Minimal typed bridge: one invoke funnel plus event subscriptions. The
 * renderer-side wrapper (renderer/src/api.ts) reconstructs full typing from
 * the shared protocol.
 */
const api = {
  invoke: (channel: string, payload: unknown): Promise<unknown> =>
    ipcRenderer.invoke('app:invoke', channel, payload),
  on: (channel: string, callback: (payload: unknown) => void): (() => void) => {
    const listener = (_event: unknown, payload: unknown): void => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

export type PreloadApi = typeof api;

contextBridge.exposeInMainWorld('api', api);
