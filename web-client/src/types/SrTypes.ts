export interface Region {
    rows: number;
    cols: number;
    cellsize: number;
    latmin: number;
    lonmin: number;
    latmax: number;
    lonmax: number;
    geojson: string;
  }
  
  export interface Raster extends Region {}
  
  export interface Poly {
    lon: number;
    lat: number;
  }
  
  export interface Output {
    open_on_complete: boolean;
    with_validation: boolean;
    format: string;
    with_checksum: boolean;
    asset: string;
    region: string;
    path: string;
    credentials: Record<string, any>;
    as_geo: boolean;
    ancillary: any[];
  }
  
  export interface Parms {
    region_mask: Region;
    read_timeout: number;
    environment_version: string;
    samples: Record<string, any>;
    cluster_size_hint: number;
    key_space: number;
    sliderule_version: string;
    timeout: number;
    rqst_timeout: number;
    raster: Raster;
    poly: Poly[];
    output: Output;
    proj: string;
    node_timeout: number;
    build_information: string;
    points_in_polygon: number;
  }
  
  export interface Rqst {
    endpoint: string;
    parms: Parms;
  }
  
  export interface Server {
    rqst: Rqst;
    environment: string;
    version: string;
    duration: number;
    packages: string[];
    commit: string;
    launch: string;
  }
  
  export interface RecordInfo {
    time: string;
    as_geo: boolean;
    x: string;
    y: string;
  }
  export interface SrRequestPayload {
    atl24?: {};
    atl08?: {};
  }
  
  export interface SrSvrParmsUsed extends SrRequestPayload {
    server?: Server;
    poly?: LatLon[]; // supports atl24x and new format TBD
    recordinfo?: RecordInfo;
    atl24?: {};
    atl08?: {};
  }
  
  export interface SrMetaData {
    SrSvrParmsUsed: SrRequestPayload;
  }
  
  interface LatLon {
    lat: number;
    lon: number;
  }
  
  export interface SrSvrParmsPolyOnly {
  }
export interface SrMenuItem {
    name: string;
    value: string;
}
  
export interface SrMenuNumberItem {
    label: string;
    value: number;
    parentReqId?: number;
    api?: string;
}
export interface SrPrimeTreeNode {
    key: string;
    label: string;
    data: number;
    children?: SrPrimeTreeNode[];
    api?: string;
    [key: string]: any; // For additional properties
}
export interface SrListNumberItem {
    label: string;
    value: number;
}
export interface SrListStringItem {
    label: string;
    value: string;
}
export interface SrMultiSelectNumberItem {
    name: string;
    value: number;
}
export interface SrMultiSelectTextItem {
    name: string;
    value: string; 
}
export type AppendToType =  HTMLElement | "body" | "self" | undefined; 

export interface SrRadioItem {
  name: string;
  key: string;
}

export type SrRGBAColor = [number, number, number, number];

export type SrPosition = [number, number, number];

// Define a type for the valid API names
export const API_NAMES = ['atl06p', 'atl06sp', 'atl08p', 'atl03sp', 'atl03x', 'atl03vp','atl03x-surface','atl03x-phoreal', 'atl24x', 'atl13x', 'gedi01bp', 'gedi02ap', 'gedi04ap'] as const;
export type ApiName = (typeof API_NAMES)[number];

export function isValidAPI(api: string): api is ApiName {
    return API_NAMES.includes(api as ApiName);
}

export const EL_LAYER_NAME_PREFIX = 'elevation-deck-layer'; // deck elevation layer
export const SELECTED_LAYER_NAME_PREFIX = 'selected-deck-layer'; // deck selected layer prefix
export const OL_DECK_LAYER_NAME = 'ol-deck-layer'; // open layers deck layer
export type MinMaxLowHigh = Record<string, { min: number; max: number, low: number, high: number }>;
export type MinMax = Record<string, { min: number; max: number }>;
export interface Atl13 {
  refid: number;
  name: string;
  coord: { lon: number; lat: number } | null;
}
export type Atl13Coord = { lon: number; lat: number };

export interface SrLatLon {
    lat: number;
    lon: number;
}
  
export type SrRegion = SrLatLon[];
export type OutputFormat = {
    format: 'parquet';
    as_geo: boolean;
    path: string;
    with_checksum: boolean;
};

export interface SrPhoReal {
    above_classifier?: boolean;
    binsize?: number;
    geoloc?: string; // 'mean', 'median', 'center'
    send_waveform?: boolean;
    use_abs_h?: boolean;
}

// Define the parameter type for the atl06p function
export interface AtlReqParams {
    phoreal?: SrPhoReal;
    asset?: string;
    cnf?: number[];
    ats?: number;
    cnt?: number;
    len?: number;
    res?: number;
    maxi?: number;
    poly?: SrRegion | null;
    cmr?: { polygon: SrRegion };
    output?:OutputFormat;
    [key: string]: any; // Other dynamic keys
}

export interface AtlxxReqParams {
    parms: AtlReqParams;
    resources?: string[];
}
export interface NullReqParams {
    null: null;
}
export interface SrSurfaceFit {
  maxi: number;
  h_win: number;
  sigma_r: number;
}
  
export type ReqParams = AtlReqParams | AtlxxReqParams | NullReqParams;
export type SrLonLatPoint = { lon: number; lat: number };
export const polyColor = 'rgba(255, 0, 0, 1)';   // red
export const hullColor = 'rgba(0, 0, 255, 1)';   // blue
export const pointColor = 'rgba(0, 200, 0, 1)';  // green
