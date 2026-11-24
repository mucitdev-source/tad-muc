const path = require("path");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const copy = require("recursive-copy");

//const WIN_SSL_DIR = '../../../openssl-1.1';

/*
 * MUC hardening: flip Electron fuses on the packaged executable.
 *  - RunAsNode off: Tad.exe can no longer be used as a Node.js interpreter
 *    (ELECTRON_RUN_AS_NODE=1), i.e. it cannot serve as a "living off the
 *    land" binary to run arbitrary scripts.
 *  - NODE_OPTIONS and --inspect/--inspect-brk ignored: no code injection or
 *    debugger attach through environment variables / command line.
 *  - OnlyLoadAppFromAsar on: the app code is only loaded from app.asar.
 *
 * GrantFileProtocolExtraPrivileges is left at its default (on): Tad loads
 * its UI from file:// inside app.asar, which stops working when that fuse is
 * off. Turning it off requires serving the UI from a custom protocol first.
 */
async function flipElectronFuses(context) {
  const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
  const platform = context.packager.platform.name;
  const productFilename = context.packager.appInfo.productFilename;
  let exeName;
  if (platform === "windows") {
    exeName = `${productFilename}.exe`;
  } else if (platform === "mac") {
    exeName = `${productFilename}.app`;
  } else {
    exeName = context.packager.executableName;
  }
  const electronBinaryPath = path.join(context.appOutDir, exeName);
  console.log("afterPack: flipping Electron fuses on", electronBinaryPath);
  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: platform === "mac",
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
}

async function afterPack(context) {
  console.log("afterPack hook called:", context.packager.platform.name);
  console.log('skipping OpenSSL bundling (no longer required by duckdb)');
  await flipElectronFuses(context);
  /*
  if (context.packager.platform.name === "mac") {
    console.log("On Mac, running dylib-fixup script:");
    const { appOutDir } = context;
    const addonPath = path.join(
      appOutDir,
      "Tad.app/Contents/Resources/app.asar.unpacked/node_modules/duckdb/lib/binding/duckdb.node"
    );
    const { stdout, stderr } = await exec(
      `./tools/dylib-fixup.sh ${addonPath}`
    );
    console.log(stdout);
    console.error(stderr);
  }
  if (context.packager.platform.name === "windows") {
    const WIN_SSL_DIR = process.env.OPENSSL_ROOT_DIR;
    console.log("On Windows, packaging OPENSSL dlls from ", WIN_SSL_DIR);
    const { appOutDir } = context;
    const duckDbTargetDir = path.join(
      appOutDir,
      "resources/app.asar.unpacked/node_modules/duckdb/lib/binding"
    );
    const sslBinDir = path.join(WIN_SSL_DIR, "bin");
    const results = await copy(sslBinDir, duckDbTargetDir);
    console.info(
      "afterPack: Copied " +
        results.length +
        " files from SSL bin dir to target"
    );
  }
  */
}

exports.default = afterPack;
