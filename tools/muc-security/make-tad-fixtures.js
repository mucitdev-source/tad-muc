/**
 * Writes two Tad workspace files next to fixtures/sample.csv:
 *   fixtures/legit-pivot.tad      - pivot by "kota", sum(jumlah), filter jumlah > 100
 *   fixtures/malicious-aggmap.tad - same, but with SQL injected through the
 *                                   aggregate function name and the filter's
 *                                   boolean operator (must be rejected)
 * .tad files store an absolute path, so they are generated per machine.
 *
 * usage: node tools/muc-security/make-tad-fixtures.js
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "fixtures");
const sample = path.join(dir, "sample.csv");
const marker = path.join(require("os").tmpdir(), "tad-pwned-tad.csv").replace(/\\/g, "/");

const viewParams = {
  showRoot: false,
  showColumnHistograms: false,
  displayColumns: ["nama", "kota", "jumlah"],
  vpivots: ["kota"],
  pivotLeafColumn: null,
  sortKey: [],
  openPaths: { _rep: {} },
  aggMap: { jumlah: "sum" },
  defaultFormats: {},
  columnFormats: {},
  showHiddenCols: false,
  filterExp: {
    expType: "FilterExp",
    op: "AND",
    opArgs: [
      {
        expType: "BinRelExp",
        op: "GT",
        lhs: { expType: "ColRef", colName: "jumlah" },
        rhs: { expType: "ConstVal", val: 100 },
      },
    ],
  },
};
const dsPath = {
  sourceId: { providerName: "localfs", resourceId: sample },
  path: ["."],
};
const write = (name, vp) => {
  const f = path.join(dir, name);
  fs.writeFileSync(
    f,
    JSON.stringify({ tadFileFormatVersion: 2, contents: { dsPath, viewParams: vp } }, null, 2)
  );
  console.log("wrote", f);
};

write("legit-pivot.tad", viewParams);
const evil = JSON.parse(JSON.stringify(viewParams));
evil.aggMap = {
  jumlah: `sum("jumlah")) AS x FROM sample; COPY (SELECT 42 AS hacked) TO '${marker}'; SELECT (sum`,
};
evil.filterExp.op = `OR 1=1; COPY (SELECT 42) TO '${marker}'; --`;
write("malicious-aggmap.tad", evil);
console.log("A hardened build must refuse malicious-aggmap.tad and never create", marker);
