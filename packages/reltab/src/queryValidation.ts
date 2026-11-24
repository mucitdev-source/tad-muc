/**
 * MUC hardening: strict validation of query structures received from an
 * untrusted side (the renderer process, a saved .tad workspace file, or a web
 * client) before they are turned into SQL.
 *
 * reltab builds SQL by string interpolation. Several fields of a query are
 * interpolated without quoting (table names, aggregate function names,
 * arithmetic operators, CAST type names, window functions, and the raw text of
 * "sql" queries). A crafted .tad file could therefore make DuckDB run arbitrary
 * SQL (COPY ... TO, reading other local files, INSTALL/LOAD, ...).
 *
 * This module whitelists every such field. Anything that does not match the
 * shapes reltab itself produces is rejected with a QueryValidationError.
 */

export class QueryValidationError extends Error {
  constructor(msg: string) {
    super("Rejected query: " + msg);
    this.name = "QueryValidationError";
  }
}

export interface QueryValidationPolicy {
  /** allow the "sql" operator (raw SQL text). Off by default. */
  allowSqlQuery: boolean;
}

const policy: QueryValidationPolicy = {
  allowSqlQuery: false,
};

/** Adjust the validation policy (e.g. an embedding app that needs raw SQL). */
export const setQueryValidationPolicy = (
  p: Partial<QueryValidationPolicy>
): void => {
  Object.assign(policy, p);
};

export const getQueryValidationPolicy = (): QueryValidationPolicy => ({
  ...policy,
});

const MAX_DEPTH = 200;

// Plain identifiers, optionally qualified (schema.table or catalog.schema.table)
const IDENT_PART = "[A-Za-z_][A-Za-z0-9_$]*";
const TABLE_NAME_RE = new RegExp(`^${IDENT_PART}(\\.${IDENT_PART}){0,2}$`);
// SQL type names such as VARCHAR, DOUBLE PRECISION, DECIMAL(18,3),
// TIMESTAMP WITH TIME ZONE, INTEGER[]
const SQL_TYPE_NAME_RE =
  /^[A-Za-z][A-Za-z0-9_]*( [A-Za-z][A-Za-z0-9_]*)*(\(\d{1,4}(, ?\d{1,4})?\))?(\[\])?$/;

const AGG_FNS = new Set([
  "avg",
  "count",
  "min",
  "max",
  "sum",
  "uniq",
  "null",
  "nullstr",
]);
const BIN_VAL_OPS = new Set(["+", "-", "*", "/"]);
const UNARY_VAL_OPS = new Set(["round", "floor", "ceil"]);
const WINDOW_FNS = new Set(["row_number"]);
const BIN_REL_OPS = new Set([
  "EQ",
  "NEQ",
  "GT",
  "GE",
  "LT",
  "LE",
  "BEGINS",
  "NOTBEGINS",
  "ENDS",
  "NOTENDS",
  "CONTAINS",
  "NOTCONTAINS",
  "IN",
  "NOTIN",
]);
const IN_OPS = new Set(["IN", "NOTIN"]);
const UNARY_REL_OPS = new Set(["ISNULL", "NOTNULL"]);
const BOOL_OPS = new Set(["AND", "OR"]);
const JOIN_TYPES = new Set(["LeftOuter"]);
const COLUMN_KINDS = new Set([
  "string",
  "integer",
  "real",
  "boolean",
  "date",
  "time",
  "datetime",
  "timestamp",
  "blob",
  "dialect",
]);

const fail = (path: string, msg: string): never => {
  throw new QueryValidationError(`${path}: ${msg}`);
};

const isPlainObject = (v: any): boolean =>
  v != null && typeof v === "object" && !Array.isArray(v);

const checkString = (v: any, path: string): void => {
  if (typeof v !== "string") {
    fail(path, "expected a string");
  }
};

const checkStringArray = (v: any, path: string): void => {
  if (!Array.isArray(v)) {
    fail(path, "expected an array");
  }
  v.forEach((s: any, i: number) => checkString(s, `${path}[${i}]`));
};

const checkEnum = (v: any, allowed: Set<string>, path: string): void => {
  if (typeof v !== "string" || !allowed.has(v)) {
    fail(path, `unexpected value ${JSON.stringify(v)}`);
  }
};

export const isSafeTableName = (name: any): boolean =>
  typeof name === "string" && TABLE_NAME_RE.test(name);

export const validateTableName = (name: any, path = "tableName"): void => {
  if (!isSafeTableName(name)) {
    fail(path, `invalid table name ${JSON.stringify(name)}`);
  }
};

const checkScalar = (v: any, path: string): void => {
  if (
    v === null ||
    typeof v === "string" ||
    typeof v === "boolean" ||
    typeof v === "bigint" ||
    (typeof v === "number" && Number.isFinite(v))
  ) {
    return;
  }
  fail(path, "constant must be a string, finite number, boolean or null");
};

const checkColumnType = (ct: any, path: string): void => {
  if (!isPlainObject(ct)) {
    fail(path, "expected a column type object");
  }
  if (
    typeof ct.sqlTypeName !== "string" ||
    !SQL_TYPE_NAME_RE.test(ct.sqlTypeName)
  ) {
    fail(path + ".sqlTypeName", "invalid SQL type name");
  }
  if (ct.kind !== undefined) {
    checkEnum(ct.kind, COLUMN_KINDS, path + ".kind");
  }
};

/** Validate a ValExp / ColumnExtendExp */
const checkValExp = (
  v: any,
  path: string,
  depth: number,
  allowInList = false
): void => {
  if (depth > MAX_DEPTH) {
    fail(path, "expression nested too deeply");
  }
  if (!isPlainObject(v)) {
    fail(path, "expected an expression object");
  }
  switch (v.expType) {
    case "ConstVal":
      if (allowInList && Array.isArray(v.val)) {
        v.val.forEach((e: any, i: number) =>
          checkString(e, `${path}.val[${i}]`)
        );
      } else {
        checkScalar(v.val, path + ".val");
      }
      break;
    case "ColRef":
      checkString(v.colName, path + ".colName");
      if (v.tblAlias != null) {
        if (typeof v.tblAlias !== "string" || !TABLE_NAME_RE.test(v.tblAlias)) {
          fail(path + ".tblAlias", "invalid table alias");
        }
      }
      break;
    case "WindowExp":
      checkEnum(v.fn, WINDOW_FNS, path + ".fn");
      break;
    case "BinValExp":
      checkEnum(v.op, BIN_VAL_OPS, path + ".op");
      checkValExp(v.lhs, path + ".lhs", depth + 1);
      checkValExp(v.rhs, path + ".rhs", depth + 1);
      break;
    case "UnaryValExp":
      checkEnum(v.op, UNARY_VAL_OPS, path + ".op");
      checkValExp(v.arg, path + ".arg", depth + 1);
      break;
    case "CastExp":
      checkColumnType(v.asType, path + ".asType");
      checkValExp(v.subExp, path + ".subExp", depth + 1);
      break;
    case "AsString":
      checkValExp(v.valExp, path + ".valExp", depth + 1);
      break;
    default:
      fail(path, `unknown expression type ${JSON.stringify(v.expType)}`);
  }
};

const checkFilterExp = (f: any, path: string, depth: number): void => {
  if (depth > MAX_DEPTH) {
    fail(path, "filter nested too deeply");
  }
  if (!isPlainObject(f)) {
    fail(path, "expected a filter expression");
  }
  switch (f.expType) {
    case "FilterExp":
      checkEnum(f.op, BOOL_OPS, path + ".op");
      if (!Array.isArray(f.opArgs)) {
        fail(path + ".opArgs", "expected an array");
      }
      f.opArgs.forEach((a: any, i: number) =>
        checkFilterExp(a, `${path}.opArgs[${i}]`, depth + 1)
      );
      break;
    case "BinRelExp":
      checkEnum(f.op, BIN_REL_OPS, path + ".op");
      checkValExp(f.lhs, path + ".lhs", depth + 1);
      checkValExp(f.rhs, path + ".rhs", depth + 1, IN_OPS.has(f.op));
      break;
    case "UnaryRelExp":
      checkEnum(f.op, UNARY_REL_OPS, path + ".op");
      checkValExp(f.arg, path + ".arg", depth + 1);
      break;
    default:
      fail(path, `unknown filter type ${JSON.stringify(f.expType)}`);
  }
};

const checkColumnMapInfo = (info: any, path: string): void => {
  if (!isPlainObject(info)) {
    fail(path, "expected a column map entry");
  }
  if (info.id != null) checkString(info.id, path + ".id");
  if (info.displayName != null)
    checkString(info.displayName, path + ".displayName");
};

/** Validate a QueryRep (the `_rep` of a QueryExp). */
export const validateQueryRep = (
  rep: any,
  path = "query",
  depth = 0
): void => {
  if (depth > MAX_DEPTH) {
    fail(path, "query nested too deeply");
  }
  if (!isPlainObject(rep)) {
    fail(path, "expected a query object");
  }
  const sub = (r: any, p: string) => validateQueryRep(r, p, depth + 1);
  switch (rep.operator) {
    case "sql":
      if (!policy.allowSqlQuery) {
        fail(path, "raw SQL queries are not permitted");
      }
      checkString(rep.sqlQuery, path + ".sqlQuery");
      break;
    case "table":
      validateTableName(rep.tableName, path + ".tableName");
      break;
    case "project":
      checkStringArray(rep.cols, path + ".cols");
      sub(rep.from, path + ".from");
      break;
    case "groupBy":
      checkStringArray(rep.cols, path + ".cols");
      if (!Array.isArray(rep.aggs)) {
        fail(path + ".aggs", "expected an array");
      }
      rep.aggs.forEach((a: any, i: number) => {
        const ap = `${path}.aggs[${i}]`;
        if (typeof a === "string") return;
        if (!Array.isArray(a) || a.length !== 2) {
          fail(ap, "expected column name or [aggFn, column]");
        }
        checkEnum(a[0], AGG_FNS, ap + "[0]");
        checkString(a[1], ap + "[1]");
      });
      sub(rep.from, path + ".from");
      break;
    case "filter":
      checkFilterExp(rep.fexp, path + ".fexp", depth + 1);
      sub(rep.from, path + ".from");
      break;
    case "mapColumns":
    case "mapColumnsByIndex":
      if (!isPlainObject(rep.cmap)) {
        fail(path + ".cmap", "expected an object");
      }
      for (const k of Object.keys(rep.cmap)) {
        checkColumnMapInfo(rep.cmap[k], `${path}.cmap[${JSON.stringify(k)}]`);
      }
      sub(rep.from, path + ".from");
      break;
    case "concat":
      sub(rep.target, path + ".target");
      sub(rep.from, path + ".from");
      break;
    case "sort":
      if (!Array.isArray(rep.keys)) {
        fail(path + ".keys", "expected an array");
      }
      rep.keys.forEach((k: any, i: number) => {
        if (
          !Array.isArray(k) ||
          k.length !== 2 ||
          typeof k[0] !== "string" ||
          typeof k[1] !== "boolean"
        ) {
          fail(`${path}.keys[${i}]`, "expected [column, ascending]");
        }
      });
      sub(rep.from, path + ".from");
      break;
    case "extend":
      checkString(rep.colId, path + ".colId");
      checkValExp(rep.colExp, path + ".colExp", depth + 1);
      if (rep.opts != null) {
        if (!isPlainObject(rep.opts)) {
          fail(path + ".opts", "expected an object");
        }
        if (rep.opts.displayName != null)
          checkString(rep.opts.displayName, path + ".opts.displayName");
        if (rep.opts.type != null)
          checkColumnType(rep.opts.type, path + ".opts.type");
      }
      sub(rep.from, path + ".from");
      break;
    case "join":
      checkEnum(rep.joinType, JOIN_TYPES, path + ".joinType");
      if (typeof rep.on === "string") {
        checkString(rep.on, path + ".on");
      } else {
        checkStringArray(rep.on, path + ".on");
      }
      sub(rep.lhs, path + ".lhs");
      sub(rep.rhs, path + ".rhs");
      break;
    default:
      fail(path, `unknown query operator ${JSON.stringify(rep.operator)}`);
  }
};
