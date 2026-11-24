/**
 * MUC hardening: typed access to the API exposed by app/preload.js.
 * The renderer runs sandboxed with contextIsolation and no Node.js
 * integration, so this bridge is its only way to reach the main process.
 */
export interface TadApi {
  invoke(channel: string, ...args: any[]): Promise<any>;
  send(channel: string, payload?: any): void;
  on(channel: string, listener: (...args: any[]) => void): () => void;
  writeClipboardText(text: string): void;
  openExternal(url: string): void;
}

export const tadApi: TadApi = (window as any).tadApi;
