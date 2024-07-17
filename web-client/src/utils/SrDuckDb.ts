import { type AsyncDuckDB } from "@duckdb/duckdb-wasm";
import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import * as arrow from 'apache-arrow';

// Define the interface for QueryResult
export interface QueryResult {
  schema: { name: string; type: string; databaseType: string }[];
  readRows(chunkSize?: number): AsyncGenerator<{ [k: string]: any }[], void, unknown>;
}

export interface QueryChunkResult {
  length: number;
  hasMoreData: boolean;
  schema: { name: string; type: string; databaseType: string }[];
  readRows(chunkSize?: number): AsyncGenerator<{ [k: string]: any }[], void, unknown>;
}

// Define the interface for Row
export interface Row {
  [key: string]: any;
}

// Define the manual bundles for DuckDB
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

// Function to map database types to application types
const getType = (type: string) => {
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
    case "interval":
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
    case "utf8":
      return "string";
      
    default:
      return "other";
  }
};

// Function to create the DuckDB instance
export async function createDb(): Promise<AsyncDuckDB> {
  //console.log('createDb');
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const duckDB = new duckdb.AsyncDuckDB(logger, worker);
  await duckDB.instantiate(bundle.mainModule, bundle.pthreadWorker);
  return duckDB;
}

// DuckDBClient class
export class DuckDBClient {
  private _db: AsyncDuckDB | null = null;
  private static _instance: Promise<DuckDBClient> | null = null;
  private _filesInDb: Set<string> = new Set(); // Use a set to store registered files
  constructor(db?: AsyncDuckDB) {
    if (db) {
      this._db = db;
    }
  }

  // Method to get the singleton instance of DuckDBClient
  public static async getInstance(): Promise<DuckDBClient> {
    if (!this._instance) {
      this._instance = (async () => {
        const db = await createDb();
        const instance = new DuckDBClient(db);
        await instance.duckDB();
        return instance;
      })();
    }
    return this._instance;
  }


  // Method to initialize the database if not already done
  private async duckDB(): Promise<AsyncDuckDB> {
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

  // Method to execute queries
  async query(query: string, params?: any): Promise<QueryResult> {
    const conn = await this._db!.connect();
    let tbl: arrow.Table<any>;

    try {
      if (params) {
        const stmt = await conn.prepare(query);
        tbl = await stmt.query(...params);
      } else {
        tbl = await conn.query(query);
      }

      const schema = tbl.schema.fields.map(({ name, type }) => ({
        name,
        type: getType(String(type)),
        databaseType: String(type),
      }));

      return {
        schema,
        async *readRows(chunkSize = 10000) { // Default chunk size set to 100
          const rows = tbl.toArray().map((r) => Object.fromEntries(r));
          for (let i = 0; i < rows.length; i += chunkSize) {
            yield rows.slice(i, i + chunkSize);
          }
        },
      };
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    } finally {
      await conn.close();
    }
  }
  async getTotalRowCount(query: string): Promise<number> {
    const conn = await this._db!.connect();
    try {
      const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
      const result = await conn.query(countQuery);
      const rows = result.toArray();
      if (rows.length === 0) {
        return 0; // Handle case where there are no rows
      }
      const totalRows = rows[0].total;
      return totalRows;
    } catch (error) {
      console.error('Error getting total row count:', error);
      throw error;
    } finally {
      await conn.close();
    }
  }
  

    // Method to execute paginated queries
  async queryChunk(query: string, chunkSize: number = 50000, offset: number = 0, params?: any): Promise<QueryChunkResult> {
    const conn = await this._db!.connect();
    let tbl: arrow.Table<any>;
    //console.log('queryChunk query:',query,' chunkSize:',chunkSize,' offset:',offset,' params:',params);
    try {
      // Get the total number of rows for the query if this is the first chunk
      let totalRows = null;
      if(offset === 0){
        totalRows =await this.getTotalRowCount(query);
        console.warn('queryChunk totalRows:',totalRows);
      }
      const paginatedQuery = `${query} LIMIT ${chunkSize} OFFSET ${offset}`;
      if (params) {
        const stmt = await conn.prepare(paginatedQuery);
        //console.log('queryChunk stmt:',stmt);
        tbl = await stmt.query(...params);
      } else {
        //console.log('queryChunk conn.query:',paginatedQuery);
        tbl = await conn.query(paginatedQuery);
      }

      const rows = tbl.toArray().map((r) => Object.fromEntries(r));
      const schema = tbl.schema.fields.map(({ name, type }) => ({
        name,
        type: getType(String(type)),
        databaseType: String(type),
      }));
      const hasMoreData = rows.length === chunkSize && (totalRows === null || offset + rows.length < totalRows);
      //console.log('queryChunk hasMoreData:',hasMoreData,'totalRows:',totalRows,' rows.length:',rows.length,' chunkSize:',chunkSize,' tbl.numRows:',tbl.numRows);

      return {
        length: rows.length,
        hasMoreData,
        schema,
        async *readRows() {
          for (let i = 0; i < rows.length; i += chunkSize) {
            yield rows.slice(i, i + chunkSize);
          }
        },
      };
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    } finally {
      await conn.close();
    }
  }

  // async queryArray(query: string, params?: any): Promise<any[]| undefined> {
  //   const conn = await this._db!.connect();
  //   let tbl: arrow.Table<any>;

  //   try {
  //     if (params) {
  //       const stmt = await conn.prepare(query);
  //       tbl = await stmt.query(...params);
  //     } else {
  //       tbl = await conn.query(query);
  //     }
  //     return tbl.toArray();
  //   } catch (error) {
  //     console.error('queryArray error:', error);
  //     throw error;
  //   } finally {
  //     await conn.close();
  //   }
  // }

  // Method for constructing query templates
  queryTag(strings: TemplateStringsArray, ...params: any[]) {
    return [strings.join("?"), params];
  }

  // Method to escape names
  escape(name: string) {
    return `"${name}"`;
  }

  // Method to describe tables in the database
  async describeTables() {
    const conn = await this._db!.connect();
    try {
      const tables = (await conn.query(`SHOW TABLES`)).toArray();
      //console.log('describeTables tables:',tables);
      return tables.map(({ name }) => ({ name }));
    } finally {
      await conn.close();
    }
  }

  // Method to describe columns of a table
  async describeColumns({ table = 'default_table' }: { table?: string } = {}) {
    //console.log('describeColumns table:',table);
    const conn = await this._db!.connect();
    try {
      const columns = (await conn.query(`DESCRIBE ${table}`)).toArray();
      return columns.map(({ column_name, column_type }) => ({
        name: column_name,
        type: getType(column_type),
        databaseType: column_type,
      }));
    } finally {
      await conn.close();
    }
  }

  // Method to insert a Parquet file from OPFS
  async insertOpfsParquet(name: string) {
    try {
      if (!this._filesInDb.has(name)) {
        const duckDB = await this.duckDB();
        const opfsRoot = await navigator.storage.getDirectory();
        const fileHandle = await opfsRoot.getFileHandle(name, { create: false });
        const file = await fileHandle.getFile();
        const url = URL.createObjectURL(file);
        let isRegistered = false;
        try {
          await duckDB.registerFileURL(
            name,
            url,
            duckdb.DuckDBDataProtocol.HTTP,
            false,
          );
        } catch (error:any) {
          if ('File already registered' in error){
            isRegistered = true;
            console.log('insertOpfsParquet File already registered');
          } else {
            console.error('insertOpfsParquet registerFileURL error:', error);
            throw error;
          }
        }

        const conn = await duckDB.connect();
        await conn.query(
          `CREATE VIEW IF NOT EXISTS '${name}' AS SELECT * FROM parquet_scan('${name}')`,
        );
        // Add the file to the set of registered files
        if(isRegistered === false){
          this._filesInDb.add(name);
          //console.log('insertOpfsParquet inserted name:',name);
        }
      } else {
        console.log(`insertOpfsParquet File ${name} already registered`);
      }
    } catch (error) {
      console.error('insertOpfsParquet error:', error);
      throw error;
    }
  }

  // Method to execute SQL queries
//   async sql(strings: TemplateStringsArray, ...args: any[]): Promise<Row[]> {
//     const query = strings.join("?");
//     const results: QueryResult = await this.query(query, args);
//     const rows: Row[] = [];

//     for await (const row of results.readRows()) {
//       rows.push(Object.fromEntries(Object.entries(row)));
//     }

//     (rows as any).columns = results.schema.map((d) => d.name);

//     return rows;
//   }

}

// Factory function to create a DuckDB client
export async function createDuckDbClient(): Promise<DuckDBClient> {
  //console.log('createDuckDbClient');
  return DuckDBClient.getInstance();
}
