/**
 * Verifies the Electron fuses of a packaged Tad executable.
 *
 * usage: node tools/muc-security/check-fuses.js "C:\Program Files\Tad\Tad.exe"
 * (run from the repository root after `lerna bootstrap`, which installs
 *  @electron/fuses; exit code 1 if any fuse is not as expected)
 */
const path = require("path");
const fusesPath = require.resolve("@electron/fuses", {
  paths: [path.join(__dirname, "..", "..", "packages", "tad-app"), process.cwd()],
});
const { getCurrentFuseWire, FuseV1Options } = require(fusesPath);

const exe = process.argv[2];
if (!exe) {
  console.error("usage: node check-fuses.js <path to Tad executable>");
  process.exit(2);
}
const expected = {
  RunAsNode: false,
  EnableNodeOptionsEnvironmentVariable: false,
  EnableNodeCliInspectArguments: false,
  OnlyLoadAppFromAsar: true,
};
getCurrentFuseWire(exe).then(
  (wire) => {
    let ok = true;
    for (const [name, want] of Object.entries(expected)) {
      const v = wire[FuseV1Options[name]];
      const on = v === "1" || v === 49;
      const good = on === want;
      if (!good) ok = false;
      console.log(`${good ? "PASS" : "FAIL"}  ${name.padEnd(40)} ${on ? "enabled" : "disabled"}`);
    }
    console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
    process.exit(ok ? 0 : 1);
  },
  (err) => {
    console.error("cannot read fuses:", err.message);
    process.exit(1);
  }
);
