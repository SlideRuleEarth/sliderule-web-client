import Dexie from 'dexie';
import type { Table, DBCore, DBCoreTable, DBCoreMutateRequest, DBCoreMutateResponse, DBCoreGetManyRequest } from 'dexie';
import { type ReqParams, type NullReqParams } from '@/stores/reqParamsStore';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';


export interface SrTimeDelta{
    days : number,
    hours : number,
    minutes : number,
    seconds : number
}


export type ElevationPlottable = [number, number, number];


export interface SrRequestRecord {
    req_id?: number; // auto incrementing
    star?: boolean; // mark as favorite
    status?: string; // status: 'pending', 'processing', 'success', 'error'
    func?: string; // function name
    parameters?: ReqParams; //  parameters
    start_time?: Date; // start time of request
    end_time?: Date; //end time of request
    elapsed_time?: string; //  elapsed time
    status_details?: string; // status message (details of status)
    file?: string; // file name
    checksum?: bigint; // checksum
    num_bytes?: number; // number of bytes
    description?: string; // description
}

export interface SrRequestSummary {
    db_id?: number; // auto incrementing
    req_id?: number;
    extLatLon: ExtLatLon;
    extHMean: ExtHMean;
}

export interface SrColors {
    color: string;
}

export interface Atl03CnfColor {
    number: number; // Primary key
    color: string;  // 
}
export class SlideRuleDexie extends Dexie {
    // 'requests' are added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    requests!: Table<SrRequestRecord>;
    summary!: Table<SrRequestSummary>;
    colors!: Table<SrColors>;
    atl03CnfColors!: Table<Atl03CnfColor>;

    constructor() {
        super('SlideRuleDataBase');
        this.version(1).stores({
            requests: '++req_id', // req_id is auto-incrementing and the primary key here, no other keys required
            summary: '++db_id, req_id', 
            colors: '&color',  
            atl03CnfColors: 'number, &color' 
        });
        this._initializeDefaultColors();
        this._useMiddleware();
        //console.log("Database initialized.");
    }
    // Method to initialize default colors
    private async _initializeDefaultColors(): Promise<void> {
        try {
            // Check and populate atl03CnfColors
            const atl03CnfColorCount = await this.atl03CnfColors.count();
            if (atl03CnfColorCount === 0) {
                await this.restoreDefaultAtl03CnfColors();
            }

            // Check and populate colors
            const colorsCount = await this.colors.count();
            if (colorsCount === 0) {
                await this.restoreDefaultColors();
            }
        } catch (error) {
            console.error('Failed to initialize default colors:', error);
            throw error;
        }
    }


    // Method to restore default colors for the colors table
    async restoreDefaultColors(): Promise<void> {
        try {
            const defaultColors: SrColors[] = [
                { color: 'gray' },
                { color: 'slategray' },
                { color: 'yellow' },
                { color: 'green' },
                { color: 'blue' },
                { color: 'indigo' },
                { color: 'violet' },
                { color: 'red' },
                { color: 'orange' },
                { color: 'purple' },
                { color: 'pink' },
                { color: 'brown' },
                { color: 'black' },
                { color: 'white' },
                { color: 'cyan' },
            ];

            // Clear existing entries in the table
            await this.colors.clear();
            console.log('colors table cleared.');

            // Add default entries
            for (const colorEntry of defaultColors) {
                await this.colors.add(colorEntry);
            }

            console.log('Default colors restored:', defaultColors);
        } catch (error) {
            console.error('Failed to restore default colors:', error);
            throw error;
        }
    }

    // CRUD Methods for colors table

    // Method to add or update a color in colors table
    async addOrUpdateColor(color: string): Promise<void> {
        try {
            const existingColorEntry = await this.colors.where('color').equals(color).first();
            if (existingColorEntry) {
                console.log(`Color already exists in colors: ${color}`);
            } else {
                await this.colors.add({ color });
                console.log(`Color added to colors: ${color}`);
            }
        } catch (error) {
            console.error('Failed to add or update color in colors:', error);
            throw error;
        }
    }

    async setAllColors(colors: string[]): Promise<void> {   
        try {
            // Clear existing entries in the table
            await this.colors.clear();
            console.log('colors table cleared.');

            // Add new colors
            for (const color of colors) {
                await this.colors.add({ color });
            }

            console.log('All colors restored:', colors);
        } catch (error) {
            console.error('Failed to restore all colors:', error);
            throw error;
        }
    }

    // Method to get all colors from the colors table
    async getAllColors(): Promise<string[]> {
        try {
            const colorRecords = await this.colors.toArray();
            const colors = colorRecords.map(record => record.color);
            console.log('Retrieved all colors from colors:', colors);
            return colors;
        } catch (error) {
            console.error('Failed to retrieve all colors from colors:', error);
            throw error;
        }
    }

    // Method to delete a color by name from the colors table
    async deleteColor(color: string): Promise<void> {
        try {
            await this.colors.delete(color);
            console.log(`Color deleted from colors: ${color}`);
        } catch (error) {
            console.error(`Failed to delete color from colors: ${color}`, error);
            throw error;
        }
    }



    // Function to restore default colors for atl03CnfColors
    async restoreDefaultAtl03CnfColors(): Promise<void> {
        try {
            // Define default color-number pairs
            const defaultAtl03CnfColors: Atl03CnfColor[] = [
                { number: -2, color: 'gray' },
                { number: -1, color: 'slategray' },
                { number: 0, color: 'yellow' },
                { number: 1, color: 'green' },
                { number: 2, color: 'blue' },
                { number: 3, color: 'violet' },
                { number: 4, color: 'red' }
            ];

            // Clear existing entries in the table
            await this.atl03CnfColors.clear();
            console.log('atl03CnfColors table cleared.');

            // Add default entries
            for (const colorEntry of defaultAtl03CnfColors) {
                await this.atl03CnfColors.add(colorEntry);
            }

            console.log('Default atl03CnfColors restored:', defaultAtl03CnfColors);
        } catch (error) {
            console.error('Failed to restore default atl03CnfColors:', error);
            throw error;
        }
    }


    // Method to add or update a color for a given number in atl03CnfColors
    async addOrUpdateAtl03CnfColor(number: number, color: string): Promise<void> {
        try {
            // Check the number range
            if (number < -2 || number > 4) {
                throw new Error('Number must be between -2 and 4.');
            }

            // Check if there's already an entry for the given number
            const existingNumberEntry = await this.atl03CnfColors.where('number').equals(number).first();

            if (existingNumberEntry) {
                // If an entry exists with the same number, update the color
                await this.atl03CnfColors.put({ color,number });
                console.log(`Number updated in atl03CnfColors: ${color},${number}`);
            } else {
                // If no entry exists with the same number, check the size limit before adding
                const count = await this.atl03CnfColors.count();
                if (count >= 7) {
                    throw new Error('Cannot add more than 7 colors to atl03CnfColors table.');
                }

                // Add the new number-color pair
                await this.atl03CnfColors.add({ number, color });
                console.log(`Number and color added to atl03CnfColors: ${number}, ${color}`);
            }
        } catch (error) {
            console.error('Failed to add or update number and color in atl03CnfColors:', error);
            throw error;
        }
    }

    // Method to get all color-number pairs from atl03CnfColors in ascending order by number
    async getAllAtl03CnfColorNumberPairs(): Promise<Atl03CnfColor[]> {
        try {
            // Use orderBy to sort the results by the 'number' field in ascending order
            const colorRecords = await this.atl03CnfColors.orderBy('number').toArray();
            console.log('Retrieved all atl03CnfColors in ascending order:', colorRecords);
            return colorRecords;
        } catch (error) {
            console.error('Failed to retrieve all atl03CnfColors:', error);
            throw error;
        }
    }
    // Method to get an ordered list of colors from atl03CnfColors sorted by ascending number
    async getAllAtl03CnfColors(): Promise<string[]> {
        try {
            // Use orderBy to sort the results by the 'number' field in ascending order
            const colorRecords = await this.atl03CnfColors.orderBy('number').toArray();
            
            // Map the sorted records to get an array of colors
            const colors = colorRecords.map(record => record.color);
            
            console.log('Retrieved ordered list of colors:', colors);
            return colors;
        } catch (error) {
            console.error('Failed to retrieve ordered list of colors:', error);
            throw error;
        }
    }

    // Method to delete a color-number pair by color from atl03CnfColors
    async deleteAtl03CnfColor(color: string): Promise<void> {
        try {
            await this.atl03CnfColors.delete(color);
            console.log(`Color deleted from atl03CnfColors: ${color}`);
        } catch (error) {
            console.error(`Failed to delete color from atl03CnfColors: ${color}`, error);
            throw error;
        }
    }


    private _useMiddleware(): void {
        this.use({
            stack: "dbcore",
            name: "serializeDates",
            create: (downlevelDatabase: DBCore) => ({
                ...downlevelDatabase,
                table: (tableName: string) => {
                    const downlevelTable: DBCoreTable = downlevelDatabase.table(tableName);
                    return this._serializeFieldsInTable(downlevelTable);
                }
            })
        });
    }
 
    private _serializeFieldsInTable(downlevelTable: DBCoreTable): DBCoreTable {
        return {
            ...downlevelTable,
            mutate: async (req: DBCoreMutateRequest): Promise<DBCoreMutateResponse> => {
                try{
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
                } catch (error) {
                    console.error('Error during database mutation:', error);
                    throw error;
                }
            },
            getMany: async (req: DBCoreGetManyRequest): Promise<any[]> => {
                try{
                    const result = await downlevelTable.getMany(req);
                    result.forEach(obj => {
                        for (const key in obj) {
                            const value = obj[key];
                            if (typeof value === 'string') {
                                // Skip processing strings that end with 'min'
                                if (value.endsWith('min')) {
                                    continue;
                                }
                                if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
                                    obj[key] = new Date(value);
                                } else if (/^\d+n$/.test(value)) { // Check if all characters are digits followed by 'n'
                                    obj[key] = BigInt(value.slice(0, -1)); // Remove the 'n' and convert back to BigInt
                                }
                            }
                        }
                    });
                    return result;
                } catch (error) {
                    console.error('Error during database getMany:', error);
                    throw error;
                }
            }
        }
    }

    private _srTimeDelta(t1: Date, t2: Date): SrTimeDelta {
        const differenceInMs = t2.getTime() - t1.getTime();
        const secondsTotal = Math.floor(differenceInMs / 1000);
        const minutesTotal = Math.floor(secondsTotal / 60);
        const hoursTotal = Math.floor(minutesTotal / 60);
        const days = Math.floor(hoursTotal / 24);
    
        const hours = hoursTotal % 24; // Hours remainder after full days
        const minutes = minutesTotal % 60; // Minutes remainder after full hours
        const seconds = secondsTotal % 60; // Seconds remainder after full minutes
    
        return { days, hours, minutes, seconds };
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
    async getFilename(reqId: number): Promise<string> {
        try {
            const request = await this.requests.get(reqId);
            if (!request) {
                console.error(`No request found with req_id ${reqId}`);
                return '';
            }
            return request.file || '';
        } catch (error) {
            console.error(`Failed to get filename for req_id ${reqId}:`, error);
            throw error;
        }
    }
    async getFunc(req_id:number): Promise<string> {
        try {
            if(req_id && req_id > 0){
                const request = await this.requests.get(req_id);
                if (!request) {
                    console.error(`getFunc No request found with req_id ${req_id}`);
                    return '';
                }
                //console.log('getFunc req_id:',req_id,'func:',request.func, 'request:',request);
                return request.func || '';
            } else {
                console.warn(`getFunc req_id must be a positive integer. req_id: ${req_id}`);
                return '';
            }

        } catch (error) {
            console.error(`getFunc Failed to get function name for req_id ${req_id}:`, error);
            throw error;
        }
    }
    async getDescription(req_id:number): Promise<string> {
        try {
            const request = await this.requests.get(req_id);
            if (!request) {
                console.error(`No request found with req_id ${req_id}`);
                return '';
            }
            return request.description || '';
        } catch (error) {
            console.error(`Failed to get description for req_id ${req_id}:`, error);
            throw error;
        }
    }
    async getNumBytes(req_id:number): Promise<number> {
        try {
            if(req_id && req_id > 0){
                const request = await this.requests.get(req_id);
                if (!request) {
                    console.error(`getFunc No request found with req_id ${req_id}`);
                    return NaN;
                }
                return request.num_bytes || NaN;
            } else {
                console.warn(`getFunc req_id must be a positive integer. req_id: ${req_id}`);
                return NaN;
            }

        } catch (error) {
            console.error(`getFunc Failed to get function name for req_id ${req_id}:`, error);
            throw error;
        }
    }
    async getStatus(req_id:number): Promise<string> {
        try {
            const request = await this.requests.get(req_id);
            if (!request) {
                console.error(`No request found with req_id ${req_id}`);
                return '';
            }
            return request.status || '';
        } catch (error) {
            console.error(`Failed to get status for req_id ${req_id}:`, error);
            throw error;
        }
    }

    async getReqParams(req_id:number): Promise<ReqParams> {
        try {
            const request = await this.requests.get(req_id);
            if (!request) {
                console.error(`No request found with req_id ${req_id}`);
                return {} as NullReqParams;
            }
            return request.parameters || {} as NullReqParams;
        } catch (error) {
            console.error(`Failed to get parameters for req_id ${req_id}:`, error);
            throw error;
        }
    }

    async getChecksum(req_id:number): Promise<bigint> {
        try {
            const request = await this.requests.get(req_id);
            if (!request?.checksum) {
                console.error(`No checksum found for req_id ${req_id}`);
                return BigInt(0);
            }
            let cs: bigint;
            if (typeof request.checksum === 'string') {
                // Remove trailing 'n' if it exists and then convert to BigInt
                cs = BigInt((request.checksum as string).replace(/n$/, ''));
            } else if (typeof request.checksum === 'number') {
                cs = BigInt(request.checksum);
            } else {
                cs = request.checksum;
            }
            console.log('getChecksum:',req_id,'checksum:',cs,'typeof:',typeof(cs));
            return cs;
        } catch (error) {
            console.error(`Failed to get checksum for req_id ${req_id}:`, error);
            // Additional error details
            if (error instanceof Error) {
                console.error('Error name:', error.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }

    async updateRequestRecord(updateParams: Partial<SrRequestRecord>): Promise<void> {
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
            //console.log('updateRequestRecord fetching SrRequestRecord with req_id:', req_id, 'updateParams:', updateParams)
            const request = await this.requests.get(req_id);
            //console.log('updateRequestRecord updating request:', request);
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
            //console.log('updateRequestRecord calling UpdateRequest:',req_id,' with:', updates);
            await this.updateRequest(req_id, updates);
            //console.log(`updateRequestRecord: SrRequestRecord updated for req_id ${req_id} with changes:`, updates);
        } catch (error) {
            console.error(`Failed to update req_id ${req_id}:`, error);
            throw error;
        }
    }

    async getRequest(req_id:number): Promise<SrRequestRecord | undefined> {
        try {
            const request = await this.requests.get(req_id);
            if (!request) {
                console.error(`No request found with req_id ${req_id}`);
            }
            return request;
        } catch (error) {
            console.error(`Failed to get request for req_id ${req_id}:`, error);
            throw error;
        }
    }

    // Function to add a new request with status 'pending'
    async addPendingRequest(): Promise<number> {
        try {
            //console.log("Adding pending request...");
            const reqId = await this.requests.add({ 
                status: 'pending', 
                func: '', 
                parameters: {} as NullReqParams, 
                start_time: new Date(), 
                end_time: new Date()
            });
            //console.log(`Pending request added with req_id ${reqId}.`);
            return reqId;
        } catch (error) {
            console.error("Failed to add pending request:", error);
            // Optionally rethrow the error or handle it according to your error handling policy
            throw error; // Rethrowing allows the calling context to handle it further
        }
    }

    // Function to update any field of a specific request
    async updateRequest(reqId: number, updates: Partial<SrRequestRecord>): Promise<void> {
        try {
            //console.log("updateRequest: calling update with:",updates);
            const result = await this.requests.update(reqId, updates);
            if (result === 0) {
                console.error(`No request found with req_id ${reqId}.`);
            }
            // else {
            //     console.log(`updateRequest: SrRequestRecord updated for req_id ${reqId} with changes:`, updates);
            // }
        } catch (error) {
            console.error(`updateRequest: Failed to update request for req_id ${reqId}:`, error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }
    // Function to delete a specific request and its related data
    async deleteRequest(reqId: number): Promise<void> {
        try {
            // Delete associated Elevation entries
            //const elevationsDeletion = this.elevations.where({ req_id: reqId }).delete();
            // Delete the request itself
            const requestDeletion = this.requests.delete(reqId);

            // Await all deletions to ensure they complete before logging
            await Promise.all([requestDeletion]);

            console.log(`All related data deleted for req_id ${reqId}.`);
        } catch (error) {
            console.error(`Failed to delete request and related data for req_id ${reqId}:`, error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }
    
    async deleteAllRequests(): Promise<void> {
        try {
            // Delete all requests
            await this.requests.clear();
            console.warn("All requests deleted successfully.");
        } catch (error) {
            console.error("Failed to delete all requests:", error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }

    async deleteRequestSummary(reqId: number): Promise<void> {
        try {
            // Delete the request summary
            await this.summary.where('req_id').equals(reqId).delete();
            console.log(`Request summary deleted for req_id ${reqId}.`);
        } catch (error) {
            console.error(`Failed to delete request summary for req_id ${reqId}:`, error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }

    async deleteAllRequestSummaries(): Promise<void> {
        try {
            // Delete all request summaries
            await this.summary.clear();
            console.log("All request summaries deleted successfully.");
        } catch (error) {
            console.error("Failed to delete all request summaries:", error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }

    async getRequestIds(): Promise<number[]> {
        try {
            const requestIds = await this.requests.orderBy('req_id').reverse().toArray().then(requests => requests.map(req => req.req_id!));
            //console.log("Retrieved request IDs:", requestIds);
            return requestIds;
        } catch (error) {
            console.error("Failed to retrieve request IDs:", error);
            throw error;  // Rethrowing the error for further handling if needed
        }
    }

    async updateSummary(summary: SrRequestSummary): Promise<void> {
        try {
            //console.log(`Updating summary for req_id ${summary.req_id} with:`, summary);
            await this.summary.put( summary );
            //console.log(`Summary updated for req_id ${summary.req_id}.`);
        } catch (error) {
            console.error(`Failed to update summary for req_id ${summary.req_id}:`, error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }

    async addNewSummary(summary: SrRequestSummary): Promise<void> {
        try {
            console.log(`Adding summary for req_id ${summary.req_id} with:`, summary);
            await this.summary.add( summary );
            //console.log(`Summary added for req_id ${summary.req_id}.`);
        } catch (error) {
            console.error(`Failed to add summary for req_id ${summary.req_id}:`, error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }

    // Method to fetch WorkerSummary for a given req_id
    async getWorkerSummary(reqId: number): Promise<SrRequestSummary | undefined> {
        try {
            //console.log(`getWorkerSummary for req_id ${reqId}...`);
            const count = await this.summary.where('req_id').equals(reqId).count();
            if (count > 1) {
                throw new Error(`getWorkerSummary Multiple summaries found for req_id ${reqId}??`);
            }
            const summaryRecord = await this.summary.where('req_id').equals(reqId).first();
            if (!summaryRecord) {
                //console.log(`getWorkerSummary No summary found for req_id ${reqId}.`);
                return undefined;
            }
            //console.log(`getWorkerSummary Retrieved summary for req_id ${reqId}`,' summaryRecord:',summaryRecord); 
            return summaryRecord;
        } catch (error) {
            console.error(`Failed to retrieve summary for req_id ${reqId}:`, error);
            throw error; // Rethrowing the error for further handling if needed
        }
    }

    async deleteDatabase(): Promise<void> {
        try {
            console.warn(`Deleting database ${this.name}...`);
            this.close();
            await Dexie.delete(this.name);
            console.warn(`Database ${this.name} deleted successfully.`);
        } catch (error) {
            console.error(`Error deleting database ${this.name}:`, error);
            throw error;
        }
    }
}
export const db = new SlideRuleDexie();
