import Dexie from 'dexie';
import type { Table, DBCore, DBCoreTable, DBCoreMutateRequest, DBCoreMutateResponse, DBCoreGetManyRequest } from 'dexie';
import { type ReqParams, type NullReqParams } from '@/stores/reqParamsStore';


export interface SrTimeDelta{
    days : number,
    hours : number,
    minutes : number,
    seconds : number
}
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

export interface SrRequest {
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


export class SlideRuleDexie extends Dexie {
    // 'elevations' and 'requests' are added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    elevations!: Table<Elevation>; 
    requests!: Table<SrRequest>;

    constructor() {
        super('SlideRuleDataBase');
        this.version(1).stores({
            elevations: '++db_id, req_id, cycle, gt, region, rgt, spot, h_mean, latitude, longitude', // Primary key and indexed props
            requests: '++req_id', // req_id is auto-incrementing and the primary key here, no other keys required
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

    private _srTimeDelta  (t1:Date, t2:Date):SrTimeDelta {
        const differenceInMs = t2.getTime() - t1.getTime();
        const seconds = Math.floor(differenceInMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24); 
        return {days, hours, minutes, seconds}
    }
    
    private _srTimeDeltaString(srTimeDelta: SrTimeDelta): string {
        const parts: string[] = [];
    
        // For each part, if its value is not zero, add it to the parts array with proper pluralization.
        if (srTimeDelta.days > 0) {
            parts.push(`${srTimeDelta.days} day${srTimeDelta.days === 1 ? '' : 's'}`);
        }
        if (srTimeDelta.hours > 0) {
            parts.push(`${srTimeDelta.hours} hr${srTimeDelta.hours === 1 ? '' : 's'}`);
        }
        if (srTimeDelta.minutes > 0) {
            parts.push(`${srTimeDelta.minutes} min${srTimeDelta.minutes === 1 ? '' : 's'}`);
        }
        if (srTimeDelta.seconds > 0) {
            parts.push(`${srTimeDelta.seconds} sec${srTimeDelta.seconds === 1 ? '' : 's'}`);
        }
    
        // Join the parts with a comma and a space, or return a default string if no parts are added.
        return parts.length > 0 ? parts.join(', ') : '0 secs';
    }
    
    async updateRequestRecord(updateParams: Partial<SrRequest>): Promise<void> {
        const { req_id } = updateParams;
        if (!req_id) {
            console.error('Request ID is required to update. updateParams:', updateParams);
            return;
        }
        if(req_id <= 0){
            console.error('Request ID must be a positive integer. updateParams:', updateParams);
            return;
        }
        try {
            const request = await this.requests.get(req_id);
            if (!request) {
                console.error(`No request found with req_id ${req_id}`);
                return;
            }
            if (!request.start_time) {
                console.error(`Request with req_id ${req_id} has no start time.`);
                return;
            }
    
            // Set the end time to now and calculate elapsed time
            const endTime = new Date();
            const startTime = new Date(request.start_time);   
            const elapsedTime = this._srTimeDelta(startTime, endTime);
            const elapsedTimeString = this._srTimeDeltaString(elapsedTime);
    
            // Prepare the update object
            const updates = {
                ...updateParams,
                end_time: endTime,
                elapsed_time: elapsedTimeString
            };
    
            await this.updateRequest(req_id, updates);
            console.log(`SrRequest Record updated for req_id ${req_id} with changes:`, updates);
        } catch (error) {
            console.error(`Failed to update req_id ${req_id}:`, error);
            throw error;
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
    async updateRequest(reqId: number, updates: Partial<SrRequest>): Promise<void> {
        try {
            console.log("updates:",updates);
            await this.requests.update(reqId, updates);
            console.log(`SrRequest updated for req_id ${reqId} with changes:`, updates);
        } catch (error) {
            console.error(`Failed to update request for req_id ${reqId}:`, error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }
    // Function to delete a specific request and its related data
    async deleteRequest(reqId: number): Promise<void> {
        try {
            // Delete associated Elevation entries
            const elevationsDeletion = this.elevations.where({ req_id: reqId }).delete();
            // Delete the request itself
            const requestDeletion = this.requests.delete(reqId);

            // Await all deletions to ensure they complete before logging
            await Promise.all([ elevationsDeletion, requestDeletion]);

            console.log(`All related data deleted for req_id ${reqId}.`);
        } catch (error) {
            console.error(`Failed to delete request and related data for req_id ${reqId}:`, error);
            throw error; // Rethrowing the error for further handling if needed
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
    async getRequestIds(): Promise<number[]> {
        try {
            const requestIds = await this.requests.toArray().then(requests => requests.map(req => req.req_id!));
            console.log("Retrieved request IDs:", requestIds);
            return requestIds;
        } catch (error) {
            console.error("Failed to retrieve request IDs:", error);
            throw error;  // Rethrowing the error for further handling if needed
        }
    }
    
    async countElevationsByReqId(reqId: number): Promise<number> {
        try {
            // This line counts all elevations that match the given req_id
            const count = await this.elevations.where({ req_id: reqId }).count();
            console.log(`Number of elevations for req_id ${reqId}: ${count}`);
            return count;
        } catch (error) {
            console.error(`Failed to count elevations for req_id ${reqId}:`, error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }
    
}
export const db = new SlideRuleDexie();
