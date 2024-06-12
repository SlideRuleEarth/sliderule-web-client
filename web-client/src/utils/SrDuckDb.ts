import { type AsyncDuckDB } from "@duckdb/duckdb-wasm";
import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';


export const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
      mainModule: duckdb_wasm,
      mainWorker: mvp_worker,
  },
  eh: {
      mainModule: duckdb_wasm_eh,
      mainWorker: eh_worker,
  },
};

const getType = (type:string) => {
  const typeLower = type.toLowerCase();
  switch (typeLower) {
    case "bigint":
    case "int8":
    case "long":
      return "bigint";

    case "double":
    case "float8":
    case "numeric":
    case "decimal":
    case "decimal(s, p)":
    case "real":
    case "float4":
    case "float":
    case "float32":
    case "float64":
      return "number";

    case "hugeint":
    case "integer":
    case "smallint":
    case "tinyint":
    case "ubigint":
    case "uinteger":
    case "usmallint":
    case "utinyint":
    case "int4":
    case "int":
    case "signed":
    case "int2":
    case "short":
    case "int1":
    case "int64":
    case "int32":
      return "integer";

    case "boolean":
    case "bool":
    case "logical":
      return "boolean";

    case "date":
    case "interval": // date or time delta
    case "time":
    case "timestamp":
    case "timestamp with time zone":
    case "datetime":
    case "timestamptz":
      return "date";

    case "uuid":
    case "varchar":
    case "char":
    case "bpchar":
    case "text":
    case "string":
    case "utf8": // this type is unlisted in the `types`, but is returned by the db as `column_type`...
      return "string";
    default:
      return "other";
  }
};


export async function createDb(){
  // Select a bundle based on browser checks
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  // Instantiate the asynchronus version of DuckDB-wasm
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const duckDb = new duckdb.AsyncDuckDB(logger, worker);
  await duckDb.instantiate(bundle.mainModule, bundle.pthreadWorker);
  return duckDb;
}

export class DuckDBClient {
  private _db: AsyncDuckDB;
  constructor(db: AsyncDuckDB) {
    this._db = db;
  }
  async duckDB() {
    if (!this._db) {
      this._db = await createDb();
      await this._db.open({
        query: {
          castTimestampToDate: true,
        },
      });
    }
    return this._db;
  }
  async query(query:string, params:any) {
    const conn = await this._db.connect();
    let result;

    if (params) {
      const stmt = await conn.prepare(query);
      result = await stmt.query(...params);
    } else {
      result = await conn.query(query);
    }

    const schema = result.schema.fields.map(({ name, type }) => ({
      name,
      type: getType(String(type)),
      databaseType: String(type),
    }));
    return {
      schema,
      async *readRows() {
        const rows = result.toArray().map((r) => Object.fromEntries(r));
        yield rows;
      },
    };
  }

  queryTag(strings:TemplateStringsArray, ...params: any[]) {
    return [strings.join("?"), params];
  }

  escape(name: string) {
    return `"${name}"`;
  }

  async describeTables() {
    const conn = await this._db.connect();
    const tables = (await conn.query(`SHOW TABLES`)).toArray();
    return tables.map(({ name }) => ({ name }));
  }

  async describeColumns({ table = 'default_table' }: { table?: string } = {}) {
    const conn = await this._db.connect();
    const columns = (await conn.query(`DESCRIBE ${table}`)).toArray();
    return columns.map(({ column_name, column_type }) => {
      return {
        name: column_name,
        type: getType(column_type),
        databaseType: column_type,
      };
    });
  }
  async insertOpfsParquet(name:string) {
    try{
      const duckDB = await this.duckDB();
      //const res = await fetch(`./${name}`);
      //const buffer = await res.arrayBuffer();
      //await duckDB.registerFileBuffer(name, new Uint8Array(buffer));
      
      const opfsRoot = await navigator.storage.getDirectory();
      const fileHandle = await opfsRoot.getFileHandle(name, {create:false});
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);

      await duckDB.registerFileURL(
        name,
        url,
        duckdb.DuckDBDataProtocol.HTTP,
        false,
      );

      const conn = await duckDB.connect();
      await conn.query(
        `CREATE VIEW IF NOT EXISTS '${name}' AS SELECT * FROM parquet_scan('${name}')`,
      );
      await conn.close();
    } catch (error) {
      console.error('insertOpfsParquet error:',error);
      throw error;
    }

    return this;
  }
}

export async function createDuckDbClient(){
  const duckDb = await createDb();
  const duckDbClient = new DuckDBClient(duckDb);
  return duckDbClient;
}
