/*
 * main module for render process
 */
// MUC hardening: source-map-support (Node-only) removed; the renderer is
// sandboxed. DevTools uses the bundled source maps directly.
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import OneRef, { mkRef, refContainer, mutableGet, StateRef } from "oneref";
import {
  AppPane,
  AppPaneBaseProps,
  ExportFormat,
  ParquetExportOptions,
} from "tadviewer";
import { PivotRequester } from "tadviewer";
import { AppState } from "tadviewer";
import { ViewParams, actions } from "tadviewer";
import { initAppState } from "tadviewer";
import * as reltab from "reltab";
import log from "loglevel";
import { ElectronTransportClient } from "./electronClient";
import { tadApi } from "./tadApi";
import { DataSourcePath, DataSourceId, RemoteReltabConnection } from "reltab";
import { OpenParams } from "./openParams";
import "./app.css";

const initMainProcess = () => tadApi.invoke("initMain");
const remoteErrorDialog = (title: string, msg: string, fatal = false) => {
  return tadApi.invoke("errorDialog", title, msg, fatal);
};
const newWindowFromDSPath = (
  dsPath: DataSourcePath,
  stateRef: StateRef<AppState>
) => tadApi.invoke("newWindowFromDSPath", dsPath);

type InitInfo = {
  connKey: DataSourceId;
};

let delay = (ms: number) => {
  if (ms > 0) {
    log.log("injecting delay of ", ms, " ms");
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
};

function openParamsDSPath(
  openParams: OpenParams
): [DataSourcePath | null, ViewParams | null] {
  let targetDSPath: DataSourcePath | null;
  let viewParams: ViewParams | null = null;
  switch (openParams.openType) {
    case "fspath":
      const connKey: DataSourceId = {
        providerName: "localfs",
        resourceId: openParams.path,
      };
      targetDSPath = { sourceId: connKey, path: ["."] };
      break;
    case "dspath":
      targetDSPath = openParams.dsPath;
      break;
    case "tad":
      const parsedFileState = JSON.parse(openParams.fileContents!);
      const savedFileState = parsedFileState.contents;
      // attempt to migrate from version 1 format:
      if (parsedFileState.tadFileFormatVersion === 1) {
        const rawTargetPath = savedFileState.targetPath;
        log.info("Found older tad file format, targetPath: ", rawTargetPath);
        const connKey: DataSourceId = {
          providerName: "localfs",
          resourceId: rawTargetPath,
        };
        targetDSPath = { sourceId: connKey, path: ["."] };
      } else {
        targetDSPath = savedFileState.dsPath;
      }
      viewParams = ViewParams.deserialize(savedFileState.viewParams);
      break;
    case "empty":
      targetDSPath = null;
  }
  return [targetDSPath, viewParams];
}

async function openFromOpenParams(
  openParams: OpenParams | undefined,
  stateRef: StateRef<AppState>
) {
  let targetDSPath: DataSourcePath | null = null;
  let viewParams: ViewParams | null = null;

  if (openParams) {
    [targetDSPath, viewParams] = openParamsDSPath(openParams);
    if (targetDSPath !== null) {
      await actions.openDataSourcePath(
        targetDSPath,
        stateRef,
        viewParams ?? undefined
      );
    }
  }
}
// TODO: figure out how to initialize based on saved views or different file / table names
const init = async () => {
  const tStart = performance.now();
  log.setLevel(log.levels.INFO); // debug for more verbosity
  const appState = new AppState();
  const stateRef = mkRef(appState);
  const [App, listenerId] = refContainer<AppState, AppPaneBaseProps>(
    stateRef,
    AppPane
  );

  try {
    await initMainProcess();
    const tconn = new ElectronTransportClient();

    const rtc = new RemoteReltabConnection(tconn);

    var pivotRequester: PivotRequester | undefined | null = null;

    await initAppState(rtc, stateRef);

    // MUC hardening: only hand http(s) URLs to the OS; never file://,
    // smb://, or other schemes that can launch local programs.
    const openURL = (url: string) => {
      let protocol: string;
      try {
        protocol = new URL(url).protocol;
      } catch {
        log.warn("openURL: ignoring malformed URL");
        return;
      }
      if (protocol !== "http:" && protocol !== "https:") {
        log.warn("openURL: blocked URL with disallowed scheme: ", protocol);
        return;
      }
      // the main process validates the URL again before opening it
      tadApi.openExternal(url);
    };

    // MUC hardening: clipboard writes go through the main process
    const clipboard = {
      writeText: (text: string) => tadApi.writeClipboardText(text),
    };

    const root = ReactDOM.createRoot(document.getElementById("app")!);

    root.render(
      <App
        newWindow={newWindowFromDSPath}
        clipboard={clipboard}
        openURL={openURL}
        embedded={false}
        onBrowseExportPath={(exportFormat: ExportFormat) =>
          tadApi.send("browse-export-path", { exportFormat })
        }
        onExportFile={(
          exportFormat: ExportFormat,
          exportPath: string,
          parquetExportOptions: ParquetExportOptions
        ) =>
          tadApi.send("export-file", {
            exportFormat,
            exportPath,
            parquetExportOptions,
          })
        }
      />
    );
    const tRender = performance.now();
    log.debug("Time to initial render: ", (tRender - tStart) / 1000, " sec");
    pivotRequester = new PivotRequester(stateRef);

    const openParams = (window as any).openParams as OpenParams | undefined;
    await openFromOpenParams(openParams, stateRef);

    tadApi.on("request-serialize-app-state", (req) => {
      const { requestId } = req;
      const curState = mutableGet(stateRef);
      const viewState = curState.viewState;
      const { dsPath } = viewState;
      const viewParamsJS = (viewState.viewParams as any).toJS(); // weird typing issue with immmutable
      const serState = {
        dsPath,
        viewParams: viewParamsJS,
      };
      tadApi.send("response-serialize-app-state", {
        requestId,
        contents: serState,
      });
    });
    tadApi.on("set-show-hidden-cols", (val) => {
      actions.setShowHiddenCols(val, stateRef);
    });
    tadApi.on("request-serialize-filter-query", (req) => {
      // console.log("got request-serialize-filter-query: ", req);
      const { requestId } = req;
      const curState = mutableGet(stateRef);
      const baseQuery = curState.viewState.baseQuery;
      const viewParams = curState.viewState.viewParams;
      const filterRowCount = curState.viewState.queryView!.filterRowCount;
      const queryObj = {
        query: baseQuery.filter(viewParams.filterExp),
        filterRowCount,
      };
      const contents = JSON.stringify(queryObj, null, 2);
      tadApi.send("response-serialize-filter-query", {
        requestId,
        contents,
      });
    });
    tadApi.on("open-export-begin-dialog", (req) => {
      const { openState, saveFilename } = req;
      actions.setExportBeginDialogOpen(openState, stateRef);
    });
    tadApi.on("open-export-progress-dialog", (req) => {
      const { openState, exportPathBaseName } = req;
      actions.setExportProgressDialogOpen(
        openState,
        exportPathBaseName,
        stateRef
      );
    });
    tadApi.on("close-export-progress-dialog", (req) => {
      actions.setExportProgressDialogOpen(false, "", stateRef);
    });
    tadApi.on("set-export-path", (req) => {
      const { exportPath } = req;
      actions.setExportPath(exportPath, stateRef);
    });
    tadApi.on("export-progress", (req) => {
      const { percentComplete } = req;
      actions.setExportProgress(percentComplete, stateRef);
    });
    tadApi.on("open-file", (req) => {
      const { openParams } = req;
      openFromOpenParams(openParams, stateRef);
    });

    document.addEventListener("copy", function (e) {});

    tadApi.send("render-init-complete");
  } catch (e) {
    const err = e as any;
    console.error(
      "renderMain: caught error during initialization: ",
      err.message,
      err.stack
    );
    remoteErrorDialog("Error initializing Tad", err.message, true);
  }
};
init();
