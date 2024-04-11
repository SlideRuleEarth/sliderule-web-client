import Dexie, { type Table } from 'dexie';

export interface Elevation {
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
export class SlideRuleDexie extends Dexie {
  // 'elevations' is added by dexie when declaring the stores()
  // We just tell the typing system this is the case
  elevations!: Table<Elevation>; 

  constructor() {
    super('slideruleDB');
    this.version(1).stores({
      elevations: '++extent_id, cycle, gt, region, rgt, spot' // Primary key and indexed props
    });
  }
}
export const db = new SlideRuleDexie();
