/**
 * MUC hardening: IPC security helpers for the main process.
 *
 * Renderer windows now run with contextIsolation + sandbox and no Node.js
 * integration. Everything a renderer needs from the operating system goes
 * through a small set of IPC channels, and every handler checks that the
 * message comes from one of Tad's own local pages before acting on it.
 */
import path from "path";
import { fileURLToPath } from "url";
import electron, { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import log from "electron-log";

const ipcMain = electron.ipcMain;

// Directory holding the bundled HTML pages (index.html, userdocs/...).
const APP_PAGES_DIR = __dirname;

/** True when the IPC message was sent by a page shipped inside Tad itself. */
export const isTrustedSender = (
  event: IpcMainEvent | IpcMainInvokeEvent
): boolean => {
  const frame = event.senderFrame;
  if (!frame) {
    return false;
  }
  try {
    const frameUrl = new URL(frame.url);
    if (frameUrl.protocol !== "file:") {
      return false;
    }
    const framePath = fileURLToPath(frameUrl);
    const rel = path.relative(APP_PAGES_DIR, framePath);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
  } catch (e) {
    return false;
  }
};

/** For ipcMain.handle(): reject the call if the sender is not trusted. */
export const assertTrustedSender = (
  event: IpcMainEvent | IpcMainInvokeEvent,
  channel: string
): void => {
  if (!isTrustedSender(event)) {
    log.warn(
      `blocked IPC "${channel}" from untrusted sender: `,
      event.senderFrame?.url
    );
    throw new Error("IPC sender not allowed");
  }
};

/** For ipcMain.on(): returns false (and logs) if the sender is not trusted. */
export const checkTrustedSender = (
  event: IpcMainEvent,
  channel: string
): boolean => {
  if (!isTrustedSender(event)) {
    log.warn(
      `ignored IPC "${channel}" from untrusted sender: `,
      event.senderFrame?.url
    );
    return false;
  }
  return true;
};

/** Only well-formed http(s) URLs may be handed to the operating system. */
export const isSafeExternalURL = (s: unknown): s is string => {
  if (typeof s !== "string" || s.length > 2048) {
    return false;
  }
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (e) {
    return false;
  }
};

export const openExternalSafely = (s: unknown): void => {
  if (!isSafeExternalURL(s)) {
    log.warn("refused to open external URL with disallowed scheme or format");
    return;
  }
  electron.shell.openExternal(s);
};

const MAX_CLIPBOARD_CHARS = 64 * 1024 * 1024;

/** Channels that replace direct use of clipboard / shell in the renderer. */
export const registerSecureIpcHandlers = (): void => {
  ipcMain.on("clipboard-write-text", (event: IpcMainEvent, text: unknown) => {
    if (!checkTrustedSender(event, "clipboard-write-text")) {
      return;
    }
    if (typeof text !== "string" || text.length > MAX_CLIPBOARD_CHARS) {
      log.warn("clipboard-write-text: ignored invalid payload");
      return;
    }
    electron.clipboard.writeText(text);
  });
  ipcMain.on("open-external-url", (event: IpcMainEvent, target: unknown) => {
    if (!checkTrustedSender(event, "open-external-url")) {
      return;
    }
    openExternalSafely(target);
  });
};
