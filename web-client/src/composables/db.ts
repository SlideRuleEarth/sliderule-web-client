import Dexie, { type Table } from 'dexie';
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
    parameters?: ReqParams; // JSON string of parameters
    start_time?: string; // ISO string rep of start time of request
    end_time?: string; // ISO string rep of end time of request
    elapsed_time?: string; // ISO string rep of elapsed time
    status_details?: string; // status message (details of status)
}

export class SlideRuleDexie extends Dexie {
  // 'elevations' and 'requests' are added by dexie when declaring the stores()
  // We just tell the typing system this is the case
  elevations!: Table<Elevation>; 
  requests!: Table<Request>;

  constructor() {
    super('slideruleDB');
    this.version(1).stores({
      elevations: '++db_id, req_id, cycle, gt, region, rgt, spot', // Primary key and indexed props
      requests: '++req_id' // req_id is auto-incrementing and the primary key here, no other keys required 
    });
  }
  // Function to add a new request with status 'pending'
  async addPendingRequest(): Promise<number> {
    try {
        const reqId = await this.requests.add({ status: 'pending', func: '', parameters: {} as NullReqParams, start_time: new Date().toISOString(), end_time: new Date().toISOString()});
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
  // Function to delete a specific request
  async deleteRequest(reqId: number): Promise<void> {
    try {
        await this.requests.delete(reqId);
        console.log(`Request deleted for req_id ${reqId}.`);
    } catch (error) {
        console.error(`Failed to delete request for req_id ${reqId}:`, error);
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



}
export const db = new SlideRuleDexie();
