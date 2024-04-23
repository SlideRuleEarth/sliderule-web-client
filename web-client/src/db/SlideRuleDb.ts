import Dexie from 'dexie';
import type { Table, DBCore, DBCoreTable, DBCoreMutateRequest, DBCoreMutateResponse, DBCoreGetManyRequest } from 'dexie';
import { type ReqParams, type NullReqParams } from '@/stores/reqParamsStore';

export interface Elevation {
    req_id?: number;
    cycle: number;
    dh_fit_dx: number;
    extent_id: bigint;
    gt: number;
    h_mean: number;
    h_sigma: number;
    latitude: number;
    longitude: number;
    n_fit_photons: number;
    pflags: number;
    region: number;
    rgt: number;
    rms_misfit: number;
    segment_id: number;
    spot: number;
    time: Date;
    w_surface_window_final: number;
    x_atc: number;
    y_atc: number;
};

export interface Request {
    req_id?: number; // auto incrementing
    star?: boolean; // mark as favorite
    status?: string; // status: 'pending', 'processing', 'success', 'error'
    func?: string; // function name
    parameters?: ReqParams; //  parameters
    start_time?: Date; // start time of request
    end_time?: Date; //end time of request
    elapsed_time?: string; //  elapsed time
    status_details?: string; // status message (details of status)
}

export interface ExtLatLon {
    req_id: number;
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

export interface ExtHMean {
    req_id: number;
    minHMean: number;
    maxHMean: number;
    lowHMean: number;   // 5th percentile
    highHMean: number;  // 95th percentile
}

export class SlideRuleDexie extends Dexie {
    // 'elevations' and 'requests' are added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    elevations!: Table<Elevation>; 
    requests!: Table<Request>;
    extLatLon!: Table<ExtLatLon>;
    extHMean!: Table<ExtHMean>;

    constructor() {
        super('SlideRuleDataBase');
        this.version(1).stores({
            elevations: '++db_id, req_id, cycle, gt, region, rgt, spot', // Primary key and indexed props
            requests: '++req_id', // req_id is auto-incrementing and the primary key here, no other keys required
            extLatLon: 'req_id', // req_id 
            extHMean: 'req_id', // req_id
        });
        this._useMiddleware();
        console.log("Database initialized.");
    }

    private _useMiddleware(): void {
        this.use({
            stack: "dbcore",
            name: "serializeDates",
            create: (downlevelDatabase: DBCore) => ({
                ...downlevelDatabase,
                table: (tableName: string) => {
                    const downlevelTable: DBCoreTable = downlevelDatabase.table(tableName);
                    return this._serializeDatesInTable(downlevelTable);
                }
            })
        });
    }
 
    private _serializeDatesInTable(downlevelTable: DBCoreTable): DBCoreTable {
        return {
            ...downlevelTable,
            mutate: async (req: DBCoreMutateRequest): Promise<DBCoreMutateResponse> => {
                if ('values' in req) {
                    req.values = req.values.map(value => JSON.parse(JSON.stringify(value, (key, val) => {
                        if (val instanceof Date) {
                            return val.toISOString();
                        } else if (typeof val === 'bigint') {
                            return val.toString() + "n"; // Append 'n' to differentiate BigInt strings
                        } else {
                            return val;
                        }
                    })));
                }
                return downlevelTable.mutate(req);
            },
            getMany: async (req: DBCoreGetManyRequest): Promise<any[]> => {
                const result = await downlevelTable.getMany(req);
                result.forEach(obj => {
                    for (const key in obj) {
                        const value = obj[key];
                        if (typeof value === 'string') {
                            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
                                obj[key] = new Date(value);
                            } else if (value.endsWith('n')) {
                                obj[key] = BigInt(value.slice(0, -1)); // Remove the 'n' and convert back to BigInt
                            }
                        }
                    }
                });
                return result;
            }
        }
    }

    // Function to add a new request with status 'pending'
    async addPendingRequest(): Promise<number> {
        try {
            console.log("Adding pending request...");
            const reqId = await this.requests.add({ 
            status: 'pending', 
            func: '', 
            parameters: {} as NullReqParams, 
            start_time: new Date(), 
            end_time: new Date()
            });
            console.log(`Pending request added with req_id ${reqId}.`);
            return reqId;
        } catch (error) {
            console.error("Failed to add pending request:", error);
            // Optionally rethrow the error or handle it according to your error handling policy
            throw error; // Rethrowing allows the calling context to handle it further
        }
    }

    // Function to update any field of a specific request
    async updateRequest(reqId: number, updates: Partial<Request>): Promise<void> {
        try {
            console.log("updates:",updates);
            await this.requests.update(reqId, updates);
            console.log(`Request updated for req_id ${reqId} with changes:`, updates);
        } catch (error) {
            console.error(`Failed to update request for req_id ${reqId}:`, error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }
    // Function to delete a specific request and its related data
    async deleteRequest(reqId: number): Promise<void> {
        try {
            // Delete associated ExtLatLon entries
            const extLatLonDeletion = this.extLatLon.where({ req_id: reqId }).delete();
            // Delete associated ExtHMean entries
            const extHMeanDeletion = this.extHMean.where({ req_id: reqId }).delete();
            // Delete associated Elevation entries
            const elevationsDeletion = this.elevations.where({ req_id: reqId }).delete();
            // Delete the request itself
            const requestDeletion = this.requests.delete(reqId);

            // Await all deletions to ensure they complete before logging
            await Promise.all([extLatLonDeletion, extHMeanDeletion, elevationsDeletion, requestDeletion]);

            console.log(`All related data deleted for req_id ${reqId}.`);
        } catch (error) {
            console.error(`Failed to delete request and related data for req_id ${reqId}:`, error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }
    async getExtHMeanByReqId(reqId: number): Promise<ExtHMean | undefined> {
        try {
            const record = await this.extHMean.get(reqId);
            if (record) {
                console.log(`Retrieved ExtHMean for req_id ${reqId}.`, record);
                return record;
            } else {
                console.log(`No ExtHMean found for req_id ${reqId}.`);
                return undefined;
            }
        } catch (error) {
            console.error(`Failed to retrieve ExtHMean for req_id ${reqId}:`, error);
            throw error;
        }
    }
    
    async addOrUpdateHMeanStats(data: ExtHMean): Promise<void> {
        try {
            console.log("Adding or updating HMean stats for req_id:", data.req_id);
            const existingEntry = await this.extHMean.get(data.req_id);
            if (existingEntry) {
                await this.extHMean.update(data.req_id, data);
                console.log(`HMean stats updated for req_id ${data.req_id}.`);
            } else {
                await this.extHMean.add(data);
                console.log(`HMean stats added for req_id ${data.req_id}.`);
            }
        } catch (error) {
            console.error("Failed to add or update HMean stats:", error);
            throw error;
        }
    }

    async getExtLatLonByReqId(reqId: number): Promise<ExtLatLon | undefined> {
        try {
            console.log("Retrieving ExtLatLon for req_id:", reqId);
            const record = await this.extLatLon.get(reqId);
            if (record) {
                console.log(`Retrieved ExtLatLon for req_id ${reqId}.`, record);
                return record;
            } else {
                console.log(`No ExtLatLon found for req_id ${reqId}.`);
                return undefined;
            }
        } catch (error) {
            console.error(`Failed to retrieve ExtLatLon for req_id ${reqId}:`, error);
            throw error;
        }
    }

    async addOrUpdateExtLatLon(data: ExtLatLon): Promise<void> {
        try {
            console.log("Adding or updating ExtLatLon for req_id:", data.req_id);
            const existingEntry = await this.extLatLon.get(data.req_id);
            if (existingEntry) {
                await this.extLatLon.update(data.req_id, data);
                console.log(`ExtLatLon updated for req_id ${data.req_id}.`);
            } else {
                await this.extLatLon.add(data);
                console.log(`ExtLatLon added for req_id ${data.req_id}.`);
            }
        } catch (error) {
            console.error("Failed to add or update ExtLatLon:", error);
            throw error;  // Rethrowing the error for further handling if needed
        }
    }

    // Method to fetch elevation data in chunks
    async getElevationsChunk(reqId:number, offset: number, chunkSize: number): Promise<Elevation[]> {
        try {
            // Fetch a chunk of elevations starting from 'offset' and limited by 'chunkSize'
            const elevationsChunk: Elevation[] = await this.elevations.where({ req_id: reqId }).offset(offset).limit(chunkSize).toArray();
            return elevationsChunk;
        } catch (error) {
            console.error("Failed to fetch elevation chunk:", error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }
}
export const db = new SlideRuleDexie();
