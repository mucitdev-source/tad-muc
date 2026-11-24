import * as appWindow from "./appWindow";
import * as quickStart from "./quickStart";
import electron, {
  MenuItem,
  BaseWindow,
  BrowserWindow,
  KeyboardEvent,
  MenuItemConstructorOptions,
} from "electron";

const Menu = electron.Menu;

// Electron >= 29 passes a BaseWindow to menu click handlers.
const asBrowserWindow = (
  w: BaseWindow | undefined
): BrowserWindow | undefined => (w instanceof BrowserWindow ? w : undefined);
const isDarwin = process.platform === "darwin";
let appMenu: electron.Menu | null = null;
const separatorMenuItem: MenuItemConstructorOptions = {
  type: "separator",
};

const aboutTadMenuItem = () => {
  return {
    label: "About Tad",
    role: "about",
  };
};

// MUC hardening: no "Check for Updates" -- the internal build must never
// replace itself with an upstream release. Updates are distributed by IT.

export const createMenu = () => {
  const fileSubmenu: MenuItemConstructorOptions[] = [
    {
      label: "New Tad Window",
      accelerator: "CmdOrCtrl+N",
      click: (item: MenuItem, focusedWindowBase: BaseWindow | undefined) => {
        const focusedWindow = asBrowserWindow(focusedWindowBase);
        appWindow.newWindow(focusedWindow);
      },
    },

    {
      label: "Open File...",
      accelerator: "CmdOrCtrl+O",
      click: (item: MenuItem, focusedWindowBase: BaseWindow | undefined) => {
        const focusedWindow = asBrowserWindow(focusedWindowBase);
        appWindow.openDialog("openFile", focusedWindow);
      },
    },
    {
      label: "Open Directory...",
      accelerator: "CmdOrCtrl+O",
      click: (item: MenuItem, focusedWindowBase: BaseWindow | undefined) => {
        const focusedWindow = asBrowserWindow(focusedWindowBase);
        appWindow.openDialog("openDirectory", focusedWindow);
      },
    },

    separatorMenuItem,
    {
      label: "Save As...",
      accelerator: "Shift+CmdOrCtrl+S",
      click: (
        item: MenuItem,
        focusedWindowBase: BaseWindow | undefined,
        event: KeyboardEvent
      ) => {
        const focusedWindow = asBrowserWindow(focusedWindowBase);
        appWindow.saveAsDialog();
      },
    },
    {
      label: "Export...",
      click: (
        item: MenuItem,
        focusedWindowBase: BaseWindow | undefined,
        event: KeyboardEvent
      ) => {
        const focusedWindow = asBrowserWindow(focusedWindowBase);
        if (focusedWindow) {
          appWindow.beginExport(focusedWindow);
        }
      },
    },

    /*
    {
      label: "Export Filtered CSV...",
      click: (
        item: MenuItem,
        focusedWindowBase: BaseWindow | undefined,
        event: KeyboardEvent
      ) => {
        const focusedWindow = asBrowserWindow(focusedWindowBase);
        if (focusedWindow) {
          appWindow.exportFiltered(focusedWindow);
        }
      },
    },
*/
  ];

  if (!isDarwin) {
    fileSubmenu.push(separatorMenuItem);
    fileSubmenu.push({
      role: "quit",
    });
  }

  const editSubmenu: MenuItemConstructorOptions[] = [
    { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
    { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
    { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
  ];
  const viewSubmenu: MenuItemConstructorOptions[] = [
    { label: "Zoom Reset", accelerator: "CmdOrCtrl+0", role: "resetZoom" },
    { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", role: "zoomIn" },
    { label: "Zoom Out", accelerator: "CmdOrCtrl+-", role: "zoomOut" },
  ];
  const debugSubmenu: MenuItemConstructorOptions[] = [
    {
      role: "toggleDevTools",
    },
    {
      label: "Show Hidden Columns",
      type: "checkbox",
      click: (
        item: MenuItem,
        focusedWindowBase: BaseWindow | undefined,
        event: KeyboardEvent
      ) => {
        const focusedWindow = asBrowserWindow(focusedWindowBase);
        console.log("show hidden...: ", item);
        focusedWindow?.webContents.send("set-show-hidden-cols", item.checked);
      },
    },
  ];
  let helpSubmenu: MenuItemConstructorOptions[] = [
    {
      label: "Quick Start Guide",
      click: (
        item: MenuItem,
        focusedWindowBase: BaseWindow | undefined,
        event: KeyboardEvent
      ) => {
        const focusedWindow = asBrowserWindow(focusedWindowBase);
        quickStart.showQuickStart();
      },
    },
    {
      // MUC: problems are reported to internal IT Support, not upstream
      label: "Report an Issue to IT Support (it-support.mucsystem.net)",
      click: (
        item: MenuItem,
        focusedWindowBase: BaseWindow | undefined,
        event: KeyboardEvent
      ) => {
        const focusedWindow = asBrowserWindow(focusedWindowBase);
        electron.shell.openExternal("https://it-support.mucsystem.net/");
      },
    },
  ];
  const template: MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: fileSubmenu,
    },
    {
      label: "Edit",
      submenu: editSubmenu,
    },
    {
      label: "View",
      submenu: viewSubmenu,
    },
  ];

  if (process.env.NODE_ENV === "development") {
    template.push({
      label: "Debug",
      submenu: debugSubmenu as any,
    });
  }

  template.push({
    label: "Help",
    submenu: helpSubmenu,
  });

  if (isDarwin) {
    template.unshift({
      label: "Tad",
      // ignored on Mac OS; comes from plist
      submenu: [
        aboutTadMenuItem(),
        separatorMenuItem,
        {
          role: "quit",
        },
      ] as any,
    });
  }

  let oldMenu = appMenu;
  appMenu = Menu.buildFromTemplate(template as any);
  Menu.setApplicationMenu(appMenu);
};
