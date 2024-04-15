import Dexie, { type Table } from 'dexie';

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
    state: string; // states: 'pending', 'processing', 'success', 'error'
}

export class SlideRuleDexie extends Dexie {
  // 'elevations' is added by dexie when declaring the stores()
  // We just tell the typing system this is the case
  elevations!: Table<Elevation>; 
  requestStates!: Table<Request>;

  constructor() {
    super('slideruleDB');
    this.version(1).stores({
      elevations: '++db_id, req_id, cycle, gt, region, rgt, spot', // Primary key and indexed props
      requestStates: '++req_id, state' // req_id is auto-incrementing and the primary key here
    });
  }
  // Function to add a new request with state 'pending'
  async addPendingRequest(): Promise<number> {
    try {
        const reqId = await this.requestStates.add({ state: 'pending' });
        return reqId;
    } catch (error) {
        console.error("Failed to add pending request:", error);
        // Optionally rethrow the error or handle it according to your error handling policy
        throw error; // Rethrowing allows the calling context to handle it further
    }
  }
}
export const db = new SlideRuleDexie();
