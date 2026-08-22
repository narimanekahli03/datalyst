import * as duckdb from "@duckdb/duckdb-wasm";
import duckdbWasmMvp from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import duckdbWorkerMvp from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdbWasmEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import duckdbWorkerEh from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

// Bundled locally (not fetched from a CDN) so the "100% dans le navigateur"
// promise holds even offline, and so it works without any cross-origin setup.
const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: duckdbWasmMvp, mainWorker: duckdbWorkerMvp },
  eh: { mainModule: duckdbWasmEh, mainWorker: duckdbWorkerEh },
};

let enginePromise: Promise<duckdb.AsyncDuckDB> | null = null;
let connectionPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

async function createEngine(): Promise<duckdb.AsyncDuckDB> {
  const bundle = await duckdb.selectBundle(BUNDLES);
  if (!bundle.mainWorker) {
    throw new Error("DuckDB-WASM n'a pas pu sélectionner de worker compatible avec ce navigateur.");
  }
  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  return db;
}

/** Engine singleton — the WASM download + worker spin-up only ever happens once per app session. */
export function getDuckDbEngine(): Promise<duckdb.AsyncDuckDB> {
  if (!enginePromise) enginePromise = createEngine();
  return enginePromise;
}

/** Connection singleton, reused across every query and every table (re)load. */
export function getDuckDbConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (!connectionPromise) {
    connectionPromise = getDuckDbEngine().then((db) => db.connect());
  }
  return connectionPromise;
}
