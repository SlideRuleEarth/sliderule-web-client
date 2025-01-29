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
  
  export interface SrSvrParmsUsed {
    server: Server;
    recordinfo: RecordInfo;
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