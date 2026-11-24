/**
 * MUC security regression test for reltab's query validator.
 *
 * Legit query shapes produced by Tad must pass validation and still produce
 * SQL; crafted payloads (as they could arrive from a .tad workspace file or a
 * compromised renderer) must be rejected.
 *
 * usage (after building packages/reltab):
 *   node tools/muc-security/validator-test.js [path/to/packages/reltab/dist]
 */
const path = require("path");
const RT = process.argv[2] || path.join(__dirname, "..", "..", "packages", "reltab", "dist");
const R = require(path.join(RT, "reltab.js"));
const { ppSQLQuery } = require(path.join(RT, "pp.js"));
const D = R.DuckDBDialect;
const ct = D.coreColumnTypes;

// ---------- schema for SQL generation ----------
const mkSchema = (cols) => new R.Schema(D, cols.map((c) => c[0]),
  Object.fromEntries(cols.map(([id, t]) => [id, { displayName: id, columnType: t }])));
const tLap = R.tableQuery("t_laporan");
const tOther = R.tableQuery("t_other");
const tableMap = {
  [JSON.stringify(tLap._rep)]: mkSchema([["npwp", "VARCHAR"], ["nama", "VARCHAR"], ["jumlah", "INTEGER"]]),
  [JSON.stringify(tOther._rep)]: mkSchema([["npwp", "VARCHAR"], ["kota", "VARCHAR"]]),
};
const toSql = (q) => ppSQLQuery(D, R.pagedQueryToSql(D, tableMap, q._rep, 0, 100));

// ---------- legit queries (shapes Tad itself produces) ----------
const binExp = R.cast(R.floor(R.divide(R.minus(R.cast(R.col("jumlah"), ct.real), R.cast(R.constVal(0), ct.real)), R.cast(R.constVal(50), ct.real))), ct.integer);
const legit = {
  "table": tLap,
  "filter EQ/CONTAINS/IN/ISNULL": tLap.filter(R.and().eq(R.col("npwp"), R.constVal("01.234"))
      .contains(R.col("nama"), R.constVal("PT"))
      .chainBinRelExp("IN", R.col("nama"), R.constVal(["PT A", "PT B"]))
      .chainUnaryRelExp("NOTNULL", R.col("jumlah"))),
  "filter OR + nested": tLap.filter(R.or().gt(R.col("jumlah"), R.constVal(100)).subExp(R.and().isNull(R.col("nama")))),
  "groupBy default + sum + uniq": tLap.groupBy(["nama"], ["npwp", ["sum", "jumlah"], ["uniq", "npwp"]]),
  "extend pivot/depth (aggtree)": tLap.extend("_pivot", R.asString(R.col("nama")), { displayName: "_pivot" })
      .extend("_depth", R.constVal(1)).extend("_isRoot", R.constVal(false)).extend("Rec", R.constVal(1)),
  "histogram cast/floor/divide": tLap.extend("bin", binExp),
  "sort + project": tLap.sort([["nama", true], ["jumlah", false]]).project(["nama", "jumlah"]),
  "mapColumns": tLap.mapColumns({ nama: { displayName: "Nama WP" } }),
  "concat": tLap.concat(tLap),
  "join": tLap.join(tOther, "npwp"),
};

const out = { legit: [], attacks: [] };
for (const [name, q] of Object.entries(legit)) {
  const queryStr = JSON.stringify(q);           // exactly what the renderer sends
  let ok = true, err = null, sql = null;
  try {
    const back = R.deserializeQueryReq(queryStr);
    sql = toSql(back);
  } catch (e) { ok = false; err = e.message; }
  out.legit.push({ name, ok, err, sql });
}

// ---------- attack payloads (as they could appear in a crafted .tad file) ----------
const T = (rep) => JSON.stringify({ expType: "QueryExp", _rep: rep });
const tbl = { operator: "table", tableName: "t_laporan" };
const COPY = (n) => `COPY (SELECT 42 AS hacked) TO 'pwned_${n}.csv'`;
const attacks = {
  "A1 raw sql operator": T({ operator: "sql", sqlQuery: `SELECT 1; ${COPY(1)}` }),
  "A2 table name": T({ operator: "table", tableName: `t_laporan; ${COPY(2)}; --` }),
  "A3 aggregate fn name": T({ operator: "groupBy", cols: ["nama"], aggs: [[`count(*) AS x FROM t_laporan; ${COPY(3)}; SELECT sum`, "jumlah"]], from: tbl }),
  "A4 arithmetic op": T({ operator: "extend", colId: "x", opts: {}, from: tbl, colExp: { expType: "BinValExp", op: `+ 1) AS x FROM t_laporan; ${COPY(4)}; SELECT (1`, lhs: { expType: "ConstVal", val: 1 }, rhs: { expType: "ConstVal", val: 1 } } }),
  "A5 CAST type name": T({ operator: "extend", colId: "x", opts: {}, from: tbl, colExp: { expType: "CastExp", asType: { sqlTypeName: `INTEGER) AS x FROM t_laporan; ${COPY(5)}; SELECT CAST(1 AS INTEGER`, kind: "integer" }, subExp: { expType: "ConstVal", val: 1 } } }),
  "A6 array constant outside IN": T({ operator: "extend", colId: "x", opts: {}, from: tbl, colExp: { expType: "ConstVal", val: [`1 AS x FROM t_laporan; ${COPY(6)}; SELECT 1`] } }),
  "A7 window fn": T({ operator: "extend", colId: "x", opts: {}, from: tbl, colExp: { expType: "WindowExp", fn: `count(*) OVER () AS x FROM t_laporan; ${COPY(7)}; SELECT row_number` } }),
  "A8 bool op in filter": T({ operator: "filter", from: tbl, fexp: { expType: "FilterExp", op: `OR 1=1; ${COPY(8)}; --`, opArgs: [{ expType: "UnaryRelExp", op: "ISNULL", arg: { expType: "ColRef", colName: "nama" } }, { expType: "UnaryRelExp", op: "ISNULL", arg: { expType: "ColRef", colName: "npwp" } }] } }),
  "A9 look-alike object (no expType) w/ sql": JSON.stringify({ _rep: { operator: "sql", sqlQuery: COPY(9) } }),
  "A10 sql nested in join rhs": T({ operator: "join", joinType: "LeftOuter", on: "npwp", lhs: tbl, rhs: { operator: "sql", sqlQuery: COPY(10) } }),
  "A11 export request w/ sql query": JSON.stringify({ filterRowCount: 1, query: { expType: "QueryExp", _rep: { operator: "sql", sqlQuery: COPY(11) } } }),
};
for (const [name, s] of Object.entries(attacks)) {
  let rejected = false, msg = null;
  try { R.deserializeQueryReq(s); } catch (e) { rejected = true; msg = e.message; }
  out.attacks.push({ name, rejected, msg });
}
// getTableSchema RPC
for (const tn of ["t_laporan", "main.t_laporan", `t_laporan; ${COPY(12)}`]) {
  let rejected = false; try { R.validateTableName(tn); } catch (e) { rejected = true; }
  out.attacks.push({ name: `getTableSchema(${JSON.stringify(tn).slice(0, 40)})`, rejected, expectReject: tn.includes(";") });
}

// ---------- report ----------
let failures = 0;
console.log("Legit queries (must pass and generate SQL):");
for (const x of out.legit) {
  if (!x.ok) failures++;
  console.log(`  ${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.ok ? "" : "  -> " + x.err}`);
}
console.log("Attack payloads (must be rejected):");
for (const x of out.attacks) {
  const expect = x.expectReject === undefined ? true : x.expectReject;
  const ok = x.rejected === expect;
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${x.name}  -> ${x.rejected ? "rejected" : "allowed"}`);
}
console.log(failures === 0 ? "\nRESULT: PASS" : `\nRESULT: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
