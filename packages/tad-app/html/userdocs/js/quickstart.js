/*
 * Quick Start page logic.
 * MUC hardening: moved out of an inline <script> so the page can run under a
 * strict Content-Security-Policy, and switched from require("electron") to
 * the sandboxed preload bridge (window.tadQuickStart).
 */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function titledPanel(title, content) {
    return (
      '<div class="panel panel-default">' +
      '<div class="panel-heading"><h4 class="panel-title">' +
      escapeHtml(title) +
      "</h4></div>" +
      '<div class="panel-body">' +
      content +
      "</div></div>"
    );
  }

  function unixSetup(installCmd) {
    const content =
      "<p>To launch tad from the command line, you need to ensure the Tad launcher shell script is on your <code>PATH</code>. " +
      "If you have administrative rights on your machine, run the following command to create a symbolic link to " +
      "<code>tad.sh</code> in <code>/usr/local/bin</code>:<br><br>" +
      '<div class="input-group">' +
      '<input type="text" id="install-cmd" class="form-control code" value="' +
      escapeHtml(installCmd) +
      '">' +
      '<span class="input-group-btn">' +
      '<button class="btn btn-default" type="button" data-clipboard-target="#install-cmd">' +
      '<span class="glyphicon glyphicon-copy" aria-hidden="true"></span>Copy</button>' +
      "</span></div>";
    return titledPanel("macOS", content);
  }

  function winSetup(appDir) {
    const content =
      "On Windows, you should use the Control Panel to add <code>" +
      escapeHtml(appDir) +
      "</code> to your <code>PATH</code> environment variable.";
    return titledPanel("Windows", content);
  }

  async function init() {
    new Clipboard(".btn");
    const api = window.tadQuickStart;

    // external links open in the system browser (validated by the main process)
    document.addEventListener("click", function (event) {
      const link = event.target.closest("a[href]");
      if (link) {
        const href = link.getAttribute("href");
        if (/^https?:\/\//i.test(href)) {
          event.preventDefault();
          api.openExternal(href);
          return;
        }
      }
      const action = event.target.closest("[data-tad-action]");
      if (action && action.getAttribute("data-tad-action") === "open-example") {
        event.preventDefault();
        api.openExample();
      }
    });

    const setupInfo = await api.getSetupInfo();
    const { platform, appDir, appScriptPath, exeDir } = setupInfo;
    let installCmdHtml;
    if (platform === "win32") {
      installCmdHtml = winSetup(exeDir);
    } else if (platform === "darwin") {
      installCmdHtml = unixSetup("sudo ln -s " + appScriptPath + " /usr/local/bin/tad");
    }
    if (installCmdHtml) {
      document.getElementById("cmdLineSetup").innerHTML = installCmdHtml;
    }
  }

  window.addEventListener("load", init);
})();
