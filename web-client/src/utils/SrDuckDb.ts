import type { Table } from 'apache-arrow';
import type { DuckDBBundles,AsyncDuckDB } from "@duckdb/duckdb-wasm";
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
//import * as duckdb from "@duckdb/duckdb-wasm";
//import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
//import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
//import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
//import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
//import * as arrow from 'apache-arrow';


// Define the interface for QueryResult
export interface QueryResult {
  schema: { name: string; type: string; databaseType: string }[];
  readRows(chunkSize?: number): AsyncGenerator<{ [k: string]: any }[], void, unknown>;
}

export interface QueryChunkResult {
  totalRows: number | null;
  length: number;
  schema: { name: string; type: string; databaseType: string }[];
  readRows(chunkSize?: number): AsyncGenerator<{ [k: string]: any }[], void, unknown>;
}

// Define the interface for Row
export interface Row {
  [key: string]: any;
}


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


// Function to create the DuckDB instance with dynamic imports
export async function createDb(): Promise<AsyncDuckDB> {
  const { selectBundle, AsyncDuckDB, ConsoleLogger } = await import('@duckdb/duckdb-wasm');
  // Dynamically import WASM and worker modules to enable code splitting
  const duckdb_wasm = (await import('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url')).default;
  const mvp_worker = (await import('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url')).default;
  const duckdb_wasm_eh = (await import('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url')).default;
  const eh_worker = (await import('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url')).default;
  // Define the manual bundles for DuckDB
  const MANUAL_BUNDLES: DuckDBBundles = {
    mvp: {
      mainModule: duckdb_wasm,
      mainWorker: mvp_worker,
    },
    eh: {
      mainModule: duckdb_wasm_eh,
      mainWorker: eh_worker,
    },
  };
  const { mvp, eh } = MANUAL_BUNDLES;
  const bundle = await selectBundle({ mvp, eh });
  const worker = new Worker(bundle.mainWorker!);
  const logger = new ConsoleLogger();
  const duckDB = new AsyncDuckDB(logger, worker);
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
    const { Table } = await import('apache-arrow');
    const conn = await this._db!.connect();
    let tbl: Table<any>;

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
  
  // Method to execute paginated queries with in-query random sampling
  async queryChunkSampled(
    query: string,
    random_sample_factor: number = 1, // Add random_sample_factor parameter, default is 1 (no sampling)
    params?: any
  ): Promise<QueryChunkResult> {
    const conn = await this._db!.connect();
    let tbl: Table<any>;
    const chunkSize = useSrParquetCfgStore().getMaxNumPntsToDisplay(); // Default chunk size set to 100
    try {
      // Get the total number of rows for the query if this is the first chunk
      let totalRows = null;
      totalRows = await this.getTotalRowCount(query);

      // Construct the query with random sampling and pagination
      let sampledQuery = query;
      if (random_sample_factor < 1 && random_sample_factor > 0) {
        // Add random sampling clause
        sampledQuery = `${query} USING SAMPLE ${random_sample_factor * 100}% (bernoulli)`;
      }

      // Apply pagination to the potentially sampled query
      const paginatedQuery = `${sampledQuery} LIMIT ${chunkSize}`;
      //console.log('queryChunkSampled paginatedQuery:', paginatedQuery);
      if (params) {
        const stmt = await conn.prepare(paginatedQuery);
        tbl = await stmt.query(...params);
      } else {
        tbl = await conn.query(paginatedQuery);
      }

      const rows = tbl.toArray().map((r) => Object.fromEntries(r));
      const schema = tbl.schema.fields.map(({ name, type }) => ({
        name,
        type: getType(String(type)),
        databaseType: String(type),
      }));

      return {
        totalRows: totalRows,
        length: rows.length,
        schema,
        async *readRows() {
            yield rows;
        },
      };
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    } finally {
      await conn.close();
    }
  }

    // Method to execute paginated queries with in-query random sampling
    async queryForColNames(fileName:string): Promise<string[]> {
      const conn = await this._db!.connect();
      let tbl: Table<any>;
      const query = `SELECT * FROM "${fileName}" LIMIT 1`;
      try {
        tbl = await conn.query(query);
        const rows = tbl.toArray().map((r) => Object.fromEntries(r));
        return Object.keys(rows[0]);
      } catch (error) {
        console.error('Query execution error:', error);
        throw error;
      } finally {
        await conn.close();
      }
    }

  // Method for constructing query templates
  queryTag(strings: TemplateStringsArray, ...params: any[]) {
    return [strings.join("?"), params];
  }

  // Method to escape names
  escape(name: string) {
    return `"${name}"`;
  }
  // Method to insert a Parquet file from OPFS
  async insertOpfsParquet(name: string) {
    const { DuckDBDataProtocol } = await import('@duckdb/duckdb-wasm');
    try {
      //if (!this._filesInDb.has(name)) {
        const duckDB = await this.duckDB();
        const opfsRoot = await navigator.storage.getDirectory();
        const folderName = 'SlideRule'; 
        const directoryHandle = await opfsRoot.getDirectoryHandle(folderName, { create: false });
        const fileHandle = await directoryHandle.getFileHandle(name, { create: false });
        const file = await fileHandle.getFile();
        //console.log('insertOpfsParquet fileHandle:', fileHandle);
        //console.log('insertOpfsParquet file:', file);
        console.log('insertOpfsParquet file.size:', file.size);
        // if it is empty and log a warning
        if (file.size === 0) {
          console.warn(`insertOpfsParquet empty file?: ${name} file:`, file);
        }
  
        const url = URL.createObjectURL(file);
        let isRegistered = false;
        try {
          await duckDB.registerFileURL(
            name,
            url,
            DuckDBDataProtocol.HTTP,
            true,
          );
        } catch (error: any) {
          if ('File already registered' in error) {
            isRegistered = true;
            console.log('insertOpfsParquet File already registered');
          } else {
            console.error('insertOpfsParquet registerFileURL error:', error);
            throw error;
          }
        }
  
        const conn = await duckDB.connect();
        await conn.query(
          `CREATE OR REPLACE VIEW '${name}' AS SELECT * FROM parquet_scan('${name}')`,
        );
        console.log('insertOpfsParquet view created for name:', name);
  
        // Add the file to the set of registered files
        if (!isRegistered) {
          this._filesInDb.add(name);
          console.log('insertOpfsParquet inserted name:', name);
        } else {
          console.log(`insertOpfsParquet File ${name} already registered`);
        }
      // } else {
      //   console.log(`insertOpfsParquet File ${name} already registered`);
      // }
    } catch (error) {
      console.error('insertOpfsParquet error:', error);
      throw error;
    }
  }

  // Method to dump detailed metadata from a Parquet file
  async getServerReqFromMetaData(parquetFilePath: string): Promise<string | undefined> {
    const conn = await this._db!.connect();
    try {
        const query = `SELECT key, value FROM parquet_kv_metadata('${parquetFilePath}')`;
        const result = await conn.query(query);
        if (result && result.numRows > 0) {
            for (let i = 0; i < result.numRows; i++) {
                const kk = result.getChild("key");
                const kv = result.getChild("value");
                if (kk && kv) {
                    const keyArray = kk.get(i) as Uint8Array;
                    const keyString = new TextDecoder().decode(keyArray);
                    if (keyString === 'sliderule') {
                        const valueArray = kv.get(i) as Uint8Array;
                        const valueString = new TextDecoder().decode(valueArray);
                        //console.log("Raw Sliderule Metadata:", valueString);
                        try {
                          const parsedMetadata = JSON.parse(valueString);
                          const formattedMetadata = JSON.stringify(parsedMetadata, null, 2);  // Format with 2 spaces for readability
                          //console.log("Formatted Sliderule Metadata:", formattedMetadata);
                          return formattedMetadata;
                        } catch (parseError) {
                          console.error("Error parsing JSON metadata:", parseError);
                          return undefined;
                        }
                    }
                } else {
                  console.log("Key or Value is undefined at index", i);
                }
            }
        } else {
          console.log("No metadata found for the specified Parquet file.");
        }
        console.log("Sliderule metadata not found.");
        return undefined;
    } catch (error) {
        console.error("Error dumping Parquet metadata:", error);
        throw error;
    } finally {
        await conn.close();
    }
  }

}

// Factory function to create a DuckDB client
export async function createDuckDbClient(): Promise<DuckDBClient> {
  //console.log('createDuckDbClient');
  return DuckDBClient.getInstance();
}
