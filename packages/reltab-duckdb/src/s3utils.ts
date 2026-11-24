/**
 * Support routines for using s3 URLs with DuckDb.
 */
import { Connection } from "duckdb-async";
import * as log from "loglevel";

/**
 * Upstream copied AWS credentials from environment variables into DuckDB
 * settings on every connection so that s3:// URLs could be read via httpfs.
 *
 * MUC hardening: S3 access needs the httpfs extension, which is disabled in
 * this build, so this is a no-op. AWS credentials from the environment are
 * never copied into DuckDB (this also avoids a startup failure when AWS_*
 * variables happen to be set on a workstation).
 */
export async function initS3(dbConn: Connection) {
  log.debug("initS3: S3 support disabled in this build");
}
