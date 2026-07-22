/** Typed wrapper over the preload bridge, reconstructing protocol types. */
import type { EventPayloads, InvokeChannel, InvokeResults, Reply } from '@core/protocol';

declare global {
  interface Window {
    api: {
      invoke: (channel: string, payload: unknown) => Promise<unknown>;
      on: (channel: string, callback: (payload: unknown) => void) => () => void;
    };
  }
}

export async function invoke<C extends InvokeChannel>(
  channel: C,
  payload?: unknown,
): Promise<Reply<InvokeResults[C]>> {
  return (await window.api.invoke(channel, payload ?? {})) as Reply<InvokeResults[C]>;
}

export function on<C extends keyof EventPayloads>(
  channel: C,
  callback: (payload: EventPayloads[C]) => void,
): () => void {
  return window.api.on(channel, (payload) => callback(payload as EventPayloads[C]));
}
