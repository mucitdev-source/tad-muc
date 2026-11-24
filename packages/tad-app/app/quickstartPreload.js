/*
 * Preload script for the Quick Start window.
 * MUC hardening: sandboxed, contextIsolation on, no Node.js in the page.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tadQuickStart", {
  getSetupInfo: () => ipcRenderer.invoke("getSetupInfo"),
  openExample: () => ipcRenderer.invoke("openExample"),
  openExternal: (url) => ipcRenderer.send("open-external-url", String(url)),
});
