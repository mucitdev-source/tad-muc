/*
 * Preload script for Tad's main window.
 *
 * MUC hardening: the window runs with contextIsolation, sandbox and no
 * Node.js integration. This script is the only bridge between the page and
 * the main process. It exposes a narrow API (window.tadApi) whose channels
 * are allow-listed below; the page never gets ipcRenderer, require or process.
 */
const { contextBridge, ipcRenderer } = require("electron");

// openParams are appended to process.argv via webPreferences.additionalArguments
const ARG_PREFIX = "--tadOpenParams=";
let openParams = null;
for (const arg of process.argv) {
  if (arg.startsWith(ARG_PREFIX)) {
    openParams = JSON.parse(arg.slice(ARG_PREFIX.length));
  }
}

// request/response calls (ipcRenderer.invoke -> ipcMain.handle)
const INVOKE_CHANNELS = new Set([
  "initMain",
  "errorDialog",
  "newWindowFromDSPath",
  // reltab remote data source API (see reltab/src/remote/server.ts)
  "getDataSources",
  "DataSourceConnection.evalQuery",
  "DataSourceConnection.rowCount",
  "DataSourceConnection.getRootNode",
  "DataSourceConnection.getChildren",
  "DataSourceConnection.getTableName",
  "DataSourceConnection.getTableSchema",
  "DataSourceConnection.getColumnStatsMap",
]);

// one-way messages from the page to the main process
const SEND_CHANNELS = new Set([
  "render-init-complete",
  "response-serialize-app-state",
  "response-serialize-filter-query",
  "browse-export-path",
  "export-file",
]);

// one-way messages from the main process to the page
const RECEIVE_CHANNELS = new Set([
  "request-serialize-app-state",
  "request-serialize-filter-query",
  "set-show-hidden-cols",
  "open-export-begin-dialog",
  "open-export-progress-dialog",
  "close-export-progress-dialog",
  "set-export-path",
  "export-progress",
  "open-file",
]);

contextBridge.exposeInMainWorld("openParams", openParams);

contextBridge.exposeInMainWorld("tadApi", {
  invoke: (channel, ...args) => {
    if (!INVOKE_CHANNELS.has(channel)) {
      return Promise.reject(new Error("IPC channel not allowed: " + channel));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  send: (channel, payload) => {
    if (!SEND_CHANNELS.has(channel)) {
      throw new Error("IPC channel not allowed: " + channel);
    }
    ipcRenderer.send(channel, payload);
  },
  on: (channel, listener) => {
    if (!RECEIVE_CHANNELS.has(channel)) {
      throw new Error("IPC channel not allowed: " + channel);
    }
    // never hand the IpcRendererEvent (and its sender) to the page
    const wrapped = (_event, ...args) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  writeClipboardText: (text) => {
    ipcRenderer.send("clipboard-write-text", String(text));
  },
  openExternal: (url) => {
    ipcRenderer.send("open-external-url", String(url));
  },
});
