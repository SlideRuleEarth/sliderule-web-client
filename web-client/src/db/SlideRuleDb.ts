import Dexie from 'dexie';
import type { Table, DBCore, DBCoreTable, DBCoreMutateRequest, DBCoreMutateResponse, DBCoreGetManyRequest } from 'dexie';
import { type ReqParams, type NullReqParams, type AtlReqParams } from '@/types/SrTypes';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import type { SrSvrParmsUsed, SrSvrParmsPolyOnly } from '@/types/SrTypes';
import type { SrRegion } from '@/types/SrTypes';

export const DEFAULT_DESCRIPTION = '';
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
    svr_parms?: SrSvrParmsUsed; //  parameters used/returned from server
    start_time?: Date; // start time of request
    end_time?: Date; //end time of request
    elapsed_time?: string; //  elapsed time
    status_details?: string; // status message (details of status)
    file?: string; // file name
    checksum?: bigint; // checksum
    cnt?: number; // number of points
    num_bytes?: number; // number of bytes
    description?: string; // description
    srViewName?: string;
}

export interface SrRequestSummary {
    db_id?: number; // auto incrementing
    req_id?: number;
    extLatLon: ExtLatLon;
    extHMean: ExtHMean;
    numPoints: number;
}

export interface SrColors {
    color: string;
}

export interface Atl03Color {
    number: number; // Primary key
    color: string;  // 
}

export interface SrTrkFilter {
    rgt: number;
    cycle: number;
    track: number;
    beam: number;
}

export interface SrRunContext {
    reqId: number;
    parentReqId : number;
    trackFilter : SrTrkFilter;
}

// Extends SrRunContext and also has a numeric ID for Dexie
export interface SrRunContextRecord extends SrRunContext {
    id?: number; // Dexie will auto-increment this
    // ...but also flatten out the fields we want to index:
    rgt: number;           
    cycle: number;        
    track: number;        
    beam: number;         
}


export interface SrPlotConfig {
    id?: number; // let Dexie store the record at id=1
    isLarge: boolean;
    largeThreshold: number;
    progressiveChunkSize: number;
    progressiveChunkThreshold: number;
    progressiveChunkMode: string;
    defaultAtl06Color: string;
    defaultAtl06SymbolSize: number;
    defaultAtl08SymbolSize: number;
    defaultAtl03spSymbolSize: number;
    defaultAtl03vpSymbolSize: number;
    defaultGradientColorMapName: string;
    defaultGradientNumShades: number;
    defaultAtl24SymbolSize: number;
    defaultAtl03xSymbolSize: number;
}

export function hashPoly(poly: {lat: number, lon:number}[]): string {

    // Serialize the poly array into a JSON string
    const serializedPoly = JSON.stringify(
      poly.map(coord => ({ lat: round(coord.lat, 8), lon: round(coord.lon, 8) })) // Normalize precision
    );
  
    // Generate a simple hash code
    let hash = 0;
    for (let i = 0; i < serializedPoly.length; i++) {
      const char = serializedPoly.charCodeAt(i);
      hash = (hash * 31 + char) % 2 ** 32; // Keep hash in 32-bit range
    }
    console.log('hashPoly:',serializedPoly,'hash:',hash.toString(16));
    return hash.toString(16); // Return hash as a hexadecimal string
  }
  
  // Helper function to round numbers to a specific precision
  function round(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
  
function getServerParams(request:SrRequestRecord): SrSvrParmsUsed|SrSvrParmsPolyOnly|NullReqParams {
    try {
        if (request.svr_parms) {
            return request.svr_parms as SrSvrParmsUsed;
        } else {
            console.error(`No svr_parms found for req_id ${request.req_id}`);
            return {} as NullReqParams;
        }
    } catch (error) {
        console.error(`Failed to get svr_parms for req_id ${request.req_id}:`, error);
        throw error;
    }
}

export class SlideRuleDexie extends Dexie {
    // 'requests' are added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    requests!: Table<SrRequestRecord>;
    summary!: Table<SrRequestSummary>;
    colors!: Table<SrColors>;
    atl03CnfColors!: Table<Atl03Color>;
    atl08ClassColors!: Table<Atl03Color>;
    atl24ClassColors!: Table<Atl03Color>;
    runContexts!: Table<SrRunContextRecord>;
    plotConfig!: Table<SrPlotConfig>;

    constructor() {
        super('SlideRuleDataBase');
        this.version(11).stores({
            requests: '++req_id', // req_id is auto-incrementing and the primary key here, no other keys required
            summary: '++db_id, &req_id',
            colors: '&color',
            atl03CnfColors: 'number',
            atl08ClassColors: 'number',
            atl24ClassColors: 'number',
            //find runContexts by (parentReqId + rgt + cycle + beam +track) in one go, define a compound index:
            runContexts: `
                ++id, 
                &reqId, 
                parentReqId, 
                rgt, 
                cycle, 
                beam, 
                track, 
                [parentReqId+rgt+cycle+beam+track]`,
            plotConfig: 'id',  // single record table
        }).upgrade(async (tx) => {
            const table = tx.table<SrPlotConfig>('plotConfig');
            await table.toCollection().modify((rec) => {
                // If the record does not have the new fields, add them with defaults
                if (rec.defaultAtl24SymbolSize === undefined) {
                    rec.defaultAtl24SymbolSize = 4;
                }
                if (rec.defaultAtl03xSymbolSize === undefined) {
                    rec.defaultAtl03xSymbolSize = 3;
                }
            });
        });

        this._initializeDefaultColors();
        this._initializePlotConfig();
        this._useMiddleware();
    }
    // Method to initialize default colors
    private async _initializeDefaultColors(): Promise<void> {
        try {
            // Check and populate atl03CnfColors
            const atl03CnfColorCount = await this.atl03CnfColors.count();
            if (atl03CnfColorCount === 0) {
                await this.restoreDefaultAtl03CnfColors();
            }

            // Check and populate atl08ClassColors
            const atl08ClassColorCount = await this.atl08ClassColors.count();
            if (atl08ClassColorCount === 0) {
                await this.restoreDefaultAtl08ClassColors();
            }

            // Check and populate atl24ClassColors
            const atl24ClassColorCount = await this.atl24ClassColors.count();
            if (atl24ClassColorCount === 0) {
                await this.restoreDefaultAtl24ClassColors();
            }

            
            const plotConfig = await this.plotConfig.get(1);
            const gradientNumShades = plotConfig?.defaultGradientNumShades;
            const gradientColorMapName = plotConfig?.defaultGradientColorMapName;
            if(!gradientColorMapName || !gradientNumShades || gradientNumShades === 0){
                await this.updatePlotConfig({id:1,defaultGradientColorMapName:'viridis',defaultGradientNumShades:512});
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
    private async _initializePlotConfig(): Promise<void> {
        try {
            // Check if plotConfig record is already there:
            const count = await this.plotConfig.count();
            if (count === 0) {
                // Insert a single record with known id=1
                this.restorePlotConfig();
                console.warn('plotConfig table was initialized with default values.');
            } else {
                console.log('plotConfig table already has records.');
            }
        } catch (error) {
            console.error('Failed to initialize plotConfig record:', error);
            throw error;
        }
    }
      
    async restorePlotConfig(): Promise<void> {
        try {
            // Clear existing records
            await this.plotConfig.clear();

            // Insert default record
            await this.plotConfig.add({
                id: 1,
                isLarge: false,
                largeThreshold: 50000,
                progressiveChunkSize: 12000,
                progressiveChunkThreshold: 10000,
                progressiveChunkMode: 'auto',
                defaultAtl06Color: 'red',
                defaultAtl06SymbolSize: 4,
                defaultAtl08SymbolSize: 4,
                defaultAtl03spSymbolSize: 2,
                defaultAtl03vpSymbolSize: 4,
                defaultGradientColorMapName: 'viridis',
                defaultGradientNumShades: 512,
                defaultAtl24SymbolSize: 4,
                defaultAtl03xSymbolSize: 3,
            });

            console.warn('plotConfig table restored to default values.');
        } catch (error) {
            console.error('Failed to restore plotConfig:', error);
            throw error;
        }
    }

    async restoreDefaultGradientColorMap(): Promise<void> {
        try {
            const plotConfig = await this.plotConfig.get(1);
            if(plotConfig){
                await this.updatePlotConfig({id:1,defaultGradientColorMapName:'viridis',defaultGradientNumShades:512});
            }
        } catch (error) {
            console.error('Failed to restore default gradient color map:', error);
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
                { color: 'greenyellow' },
                { color: 'lightblue' },
                { color: 'lightgreen' },
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
            //console.log('colors table cleared.');

            // Add new colors
            for (const color of colors) {
                await this.colors.add({ color });
            }

            //console.log('All colors restored:', colors);
        } catch (error) {
            //console.error('Failed to restore all colors:', error);
            throw error;
        }
    }

    // Method to get all colors from the colors table
    async getAllColors(): Promise<string[]> {
        try {
            const colorRecords = await this.colors.toArray();
            const colors = colorRecords.map(record => record.color);
            //console.log('Retrieved all colors from colors:', colors);
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
            const defaultAtl03CnfColors: Atl03Color[] = [
                { number: -2, color: 'white' },
                { number: -1, color: 'slategray' },
                { number: 0, color: 'blue' },
                { number: 1, color: 'blue' },
                { number: 2, color: 'green' },
                { number: 3, color: 'yellow' },
                { number: 4, color: 'violet' }
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

    // Function to restore default colors for atl08ClassColors
    async restoreDefaultAtl08ClassColors(): Promise<void> {
        try {
            // Define default color-number pairs
            const defaultAtl08ClassColors: Atl03Color[] = [
                { number: 0, color: 'blue' }, // atl08_noise
                { number: 1, color: 'violet' }, // atl08_ground
                { number: 2, color: 'lightgreen' },   // atl08_canopy
                { number: 3, color: 'green' }, // atl08_top_of_canopy
                { number: 4, color: 'slategray' } // atl08_unclassified
            ];

            // Clear existing entries in the table
            await this.atl08ClassColors.clear();
            console.log('atl08ClassColors table cleared.');

            // Add default entries
            for (const colorEntry of defaultAtl08ClassColors) {
                await this.atl08ClassColors.add(colorEntry);
            }

            console.log('Default atl08ClassColors restored:', defaultAtl08ClassColors);
        } catch (error) {
            console.error('Failed to restore default atl08ClassColors:', error);
            throw error;
        }
    }

    // Function to restore default colors for atl24ClassColors
    async restoreDefaultAtl24ClassColors(): Promise<void> {
        try {
            const defaultAtl24ClassColors: Atl03Color[] = [
                { number: 0, color: 'purple' }, // unclassified
                { number: 1, color: 'greenyellow' }, // bathymetry
                { number: 2, color: 'lightblue' },  // sea_surface
            ];
        
            // Clear existing entries in the table
            await this.atl24ClassColors.clear();
            console.log('atl24ClassColors table cleared.');
        
            // Add default entries
            for (const colorEntry of defaultAtl24ClassColors) {
                await this.atl24ClassColors.add(colorEntry);
            }
        
            console.log('Default atl24ClassColors restored:', defaultAtl24ClassColors);
        } catch (error) {
            console.error('Failed to restore default atl24ClassColors:', error);
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
                //console.log(`Number updated in atl03CnfColors: ${color},${number}`);
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

    // Method to add or update a color for a given number in atl08ClassColors
    async addOrUpdateAtl08ClassColor(number: number, color: string): Promise<void> {
        try {
            // Check the number range
            if (number < 0 || number > 4) {
                throw new Error('Number must be between 0and 4.');
            }

            // Check if there's already an entry for the given number
            const existingNumberEntry = await this.atl08ClassColors.where('number').equals(number).first();

            if (existingNumberEntry) {
                // If an entry exists with the same number, update the color
                await this.atl08ClassColors.put({ color,number });
                console.log(`Number updated in atl08ClassColors: ${color},${number}`);
            } else {
                // If no entry exists with the same number, check the size limit before adding
                const count = await this.atl08ClassColors.count();
                if (count >= 5) {
                    throw new Error('Cannot add more than 5 colors to atl08ClassColors table.');
                }

                // Add the new number-color pair
                await this.atl08ClassColors.add({ number, color });
                console.log(`Number and color added to atl08ClassColors: ${number}, ${color}`);
            }
        } catch (error) {
            console.error('Failed to add or update number and color in atl08ClassColors:', error);
            throw error;
        }
    }

    // Method to add or update a color for a given number in atl24ClassColors
    async addOrUpdateAtl24ClassColor(number: number, color: string): Promise<void> {
        try {
            // Check the number range
            if (number < 0 || number > 2) {
                throw new Error('Number must be between 0 and 2. number:' + number);
            }

            // Check if there's already an entry for the given number
            const existingNumberEntry = await this.atl24ClassColors.where('number').equals(number).first();

            if (existingNumberEntry) {
                // If an entry exists with the same number, update the color
                await this.atl24ClassColors.put({ color,number });
                console.log(`Number updated in atl24ClassColors: ${color},${number}`);
            } else {
                // If no entry exists with the same number, check the size limit before adding
                const count = await this.atl24ClassColors.count();
                if (count >= 3) {
                    throw new Error('Cannot add more than 3 colors to atl24ClassColors table.');
                }

                // Add the new number-color pair
                await this.atl24ClassColors.add({ number, color });
                console.log(`Number and color added to at24ClassColors: ${number}, ${color}`);
            }
        } catch (error) {
            console.error('Failed to add or update number and color in atl24ClassColors:', error);
            throw error;
        }
    }

    // Method to get all color-number pairs from atl03CnfColors in ascending order by number
    async getAllAtl03CnfColorNumberPairs(): Promise<Atl03Color[]> {
        try {
            // Use orderBy to sort the results by the 'number' field in ascending order
            const colorRecords = await this.atl03CnfColors.orderBy('number').toArray();
            //console.log('Retrieved all atl03CnfColors in ascending order:', colorRecords);
            return colorRecords;
        } catch (error) {
            console.error('Failed to retrieve all atl03CnfColors:', error);
            throw error;
        }
    }

    // Method to get all color-number pairs from atl08ClassColors in ascending order by number
    async getAllAtl08ClassColorNumberPairs(): Promise<Atl03Color[]> {
        try {
            // Use orderBy to sort the results by the 'number' field in ascending order
            const colorRecords = await this.atl08ClassColors.orderBy('number').toArray();
            //console.log('Retrieved all atl08ClassColors in ascending order:', colorRecords);
            return colorRecords;
        } catch (error) {
            console.error('Failed to retrieve all atl08ClassColors:', error);
            throw error;
        }
    }

    // Method to get all color-number pairs from atl24ClassColors in ascending order by number
    async getAllAtl24ClassColorNumberPairs(): Promise<Atl03Color[]> {
        try {
            // Use orderBy to sort the results by the 'number' field in ascending order
            const colorRecords = await this.atl24ClassColors.orderBy('number').toArray();
            //console.log('Retrieved all atl24ClassColors in ascending order:', colorRecords);
            return colorRecords;
        } catch (error) {
            console.error('Failed to retrieve all atl24ClassColors:', error);
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
            
            //console.log('Retrieved ordered list of colors:', colors);
            return colors;
        } catch (error) {
            console.error('Failed to retrieve ordered list of colors:', error);
            throw error;
        }
    }

    // Method to get an ordered list of colors from atl08ClassColors sorted by ascending number
    async getAllAtl08ClassColors(): Promise<string[]> {
        try {
            // Use orderBy to sort the results by the 'number' field in ascending order
            const colorRecords = await this.atl08ClassColors.orderBy('number').toArray();
            
            // Map the sorted records to get an array of colors
            const colors = colorRecords.map(record => record.color);
            
            //console.log('Retrieved ordered list of colors:', colors);
            return colors;
        } catch (error) {
            console.error('Failed to retrieve ordered list of colors:', error);
            throw error;
        }
    }

    // Method to get an ordered list of colors from atl24ClassColors sorted by ascending number
    async getAllAtl24ClassColors(): Promise<string[]> {
        try {
            // Use orderBy to sort the results by the 'number' field in ascending order
            const colorRecords = await this.atl24ClassColors.orderBy('number').toArray();
            
            // Map the sorted records to get an array of colors
            const colors = colorRecords.map(record => record.color);
            
            //console.log('Retrieved ordered list of colors:', colors);
            return colors;
        } catch (error) {
            console.error('Failed to retrieve ordered list of colors:', error);
            throw error;
        }
    }

    // Method to delete a color-number pair by color from atl03CnfColors
    async deleteAtl03CnfColor(color: string): Promise<void> {
        try {
            await this.atl03CnfColors.where('color').equals(color).delete();
            console.log(`Color deleted from atl03CnfColors: ${color}`);
        } catch (error) {
            console.error(`Failed to delete color from atl03CnfColors: ${color}`, error);
            throw error;
        }
    }

    // Method to delete a color-number pair by color from atl08ClassColors
    async deleteAtl08ClassColor(color: string): Promise<void> {
        try {
            await this.atl08ClassColors.where('color').equals(color).delete();
            console.log(`Color deleted from atl08ClassColors: ${color}`);
        } catch (error) {
            console.error(`Failed to delete color from atl08ClassColors: ${color}`, error);
            throw error;
        }
    }

    // Method to delete a color-number pair by color from atl24ClassColors
    async deleteAtl24ClassColor(color: string): Promise<void> {
        try {
            await this.atl24ClassColors.where('color').equals(color).delete();
            console.log(`Color deleted from atl24ClassColors: ${color}`);
        } catch (error) {
            console.error(`Failed to delete color from atl24ClassColors: ${color}`, error);
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
        const startTime = performance.now(); // Start time
        let fn='';
        try {
            const request = await this.requests.get(reqId);
            if (request) {
                fn = request.file || '';
            } else {
                console.error(`No request found with req_id ${reqId}`);
            }
        } catch (error) {
            console.error(`Failed to get filename for req_id ${reqId}:`, error);
            throw error;
        } finally {
            const endTime = performance.now(); // End time
            console.log(`SlideRuleDb.getFilename |${fn}| for ${reqId} took ${endTime - startTime} milliseconds.`);
        }
        return fn;
    }
    async getFunc(req_id:number): Promise<string> {
        try {
            if(req_id && req_id > 0){
                const request = await this.requests.get(req_id);
                if (!request) {
                    console.error(`getFunc No request found with req_id ${req_id}`);
                    return '';
                }
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


    async getSvrParams(req_id:number): Promise<SrSvrParmsUsed|NullReqParams> {
        try {
            const request = await this.requests.get(req_id);
            if (request) {
                if(request.func === 'atl24x'){
                    return request.svr_parms as SrSvrParmsPolyOnly;
                } else {
                    return request.svr_parms as SrSvrParmsUsed;
                }
            } else {
                console.error(`No request found with req_id ${req_id}`);
                return {} as NullReqParams;
            }
        } catch (error) {
            console.error(`Failed to get svr_parms for req_id ${req_id}:`, error);
            throw error;
        }
    }

    async getSvrReqPoly(req_id:number): Promise<SrRegion> {
        try {
            const request = await this.requests.get(req_id);

            const svrParmsUsedStr = getServerParams(request as SrRequestRecord);

            //const svrParmsUsedStr = await this.getSvrParams(req_id) as unknown as string;
            //console.log('svrParmsUsedStr:',svrParmsUsedStr);
            if(svrParmsUsedStr){

                const svrParmsUsed: SrSvrParmsUsed = JSON.parse(svrParmsUsedStr as string);
                
                if(svrParmsUsed.server){
                    if(svrParmsUsed.server.rqst.parms){
                        return svrParmsUsed.server.rqst.parms.poly;
                    } else {
                        console.error(`No svr_parms found with req_id ${req_id}`);
                        return {} as SrRegion;
                    }
                } else if(svrParmsUsed.poly){
                    return svrParmsUsed.poly; //atl24x with new server format
                } else {
                    console.error(`No svr_parms found with req_id ${req_id}`);
                    return {} as SrRegion;
                }
            } else {
                console.error(`No svr_parms found with req_id ${req_id}`);
                return {} as SrRegion;
            }
        } catch (error) {
            console.error(`Failed to get svr_parms for req_id ${req_id}:`, error);
            throw error;
        }
    }

    async getSrViewName(req_id:number): Promise<string> {
        try {
            if(req_id && req_id > 0){
                const request = await this.requests.get(req_id);
                if (!request) {
                    console.error(`getSrViewName No request found with req_id ${req_id}`);
                    return '';
                }
                //console.log('getSrViewName req_id:',req_id,'func:',request.func, 'request:',request);
                let srViewName = request.srViewName || '';
                if((!srViewName) || (srViewName == '') || (srViewName === 'Global')){
                    srViewName = 'Global Mercator Esri';
                    console.warn(`HACK ALERT!! inserting srViewName:${srViewName} for reqId:${req_id}`);
                }
                return srViewName
            } else {
                console.warn(`getSrViewName req_id must be a positive integer. req_id: ${req_id}`);
                return '';
            }

        } catch (error) {
            console.error(`getSrViewName Failed to get SrViewName for req_id ${req_id}:`, error);
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

    async updateRequestRecord(updateParams: Partial<SrRequestRecord>, updateTime=false): Promise<void> {
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
    
            if(updateTime){
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
            } else {
                // Prepare the update object
                const updates = {
                    ...updateParams,
                };
               //console.log('updateRequestRecord calling UpdateRequest:',req_id,' with:', updates);
               await this.updateRequest(req_id, updates);
            }
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
                cnt: 0, 
                parameters: {} as NullReqParams, 
                start_time: new Date(), 
                end_time: new Date(),
                description: DEFAULT_DESCRIPTION, 
                star: false,
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

    // async updateSummary(summary: SrRequestSummary): Promise<void> {
    //     try {
    //         //console.log(`Updating summary for req_id ${summary.req_id} with:`, summary);
    //         await this.summary.put( summary );
    //         //console.log(`Summary updated for req_id ${summary.req_id}.`);
    //     } catch (error) {
    //         console.error(`Failed to update summary for req_id ${summary.req_id}:`, error);
    //         throw error; // Rethrowing the error for further handling if needed
    //     }
    // }

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
                console.error(`Multiple summaries found for req_id ${reqId}.`);
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


    async findCachedRec(runContext: SrRunContext): Promise<number | undefined> {
        try {
            const candidates = await this.runContexts
                .where('[parentReqId+rgt+cycle+beam+track]')
                .equals([
                    runContext.parentReqId, 
                    runContext.trackFilter.rgt, 
                    runContext.trackFilter.cycle, 
                    runContext.trackFilter.beam,
                    runContext.trackFilter.track
                ])
                .toArray();
    
            if (candidates.length === 0) {
                console.log(`No matching record found for run context:`, runContext);
                return undefined;
            } else {
                console.log(`Found ${candidates.length} candidate(s) for run context:`, runContext);
            }
    
            // Filter candidates by checking if corresponding request has func === 'atl03x'
            for (const rec of candidates) {
                const req = await this.requests.get(rec.reqId);
                if (req?.func === 'atl03x') {
                    return rec.reqId;
                }
            }
    
            console.log(`No atl03x func match found in ${candidates.length} candidate(s) for run context:`, runContext);
            return undefined;
        } catch (error) {
            console.error(`Failed to find matching atl03x record for run context:`, error);
            throw error;
        }
    }
        
    async addSrRunContext(runContext: SrRunContext): Promise<void> {
        try {
            const thisRunContextRecord: SrRunContextRecord = {
                reqId: runContext.reqId,
                parentReqId: runContext.parentReqId,
                trackFilter: runContext.trackFilter,
                rgt: runContext.trackFilter.rgt,
                cycle: runContext.trackFilter.cycle,
                beam: runContext.trackFilter.beam,
                track: runContext.trackFilter.track,
            };
            await this.runContexts.put(thisRunContextRecord);
        } catch (error) {
            console.error('Failed to add SrRunContext:', error);
            throw error;
        }
    }

    async removeRunContext(reqId: number): Promise<void> {
        try {
            await this.runContexts.where('reqId').equals(reqId).delete();
        } catch (error) {
            console.error(`Failed to remove run context for req_id ${reqId}:`, error);
            throw error;
        }
    }

    async getRunContext(reqId: number): Promise<SrRunContextRecord | undefined> {
        try {
            const runContext = await this.runContexts.where('reqId').equals(reqId).first();
            if (!runContext) {
                //console.log(`No run context found for req_id ${reqId}`);
            }
            return runContext;
        } catch (error) {
            console.error(`Failed to get run context for req_id ${reqId}:`, error);
            throw error;
        }
    }
    // Get the single record
    async getPlotConfig(): Promise<SrPlotConfig | undefined> {
        try {
            // We assume that there is only ever one record (id = 1).
            const config = await this.plotConfig.get(1);
            if (!config) {
                console.warn('No plotConfig record found. Did initialization fail?');
            }
            return config;
        } catch (error) {
            console.error('Error retrieving plotConfig:', error);
            throw error;
        }
    }
    
    // Update fields of the single record
    async updatePlotConfig(updates: Partial<SrPlotConfig>): Promise<void> {
        try {
            // Keep the same id, forcibly set to 1
            await this.plotConfig.update(1, updates);
            // If update returns 0, it means there was no record to update
        } catch (error) {
            console.error('Error updating plotConfig:', error);
            throw error;
        }
    }
  
}
export const db = new SlideRuleDexie();
