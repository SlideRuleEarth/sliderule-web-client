export interface CreConfigRegionMask {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface CreConfigRaster {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface CreConfigOutputCredentials {
  AccessKeyId: string;
  expiration: string;
  secretAccessKey: string;
  Token: string;
  aws_session_token: string;
  aws_secret_access_key: string;
  aws_access_key_id: string;
  sessionToken: string;
  accessKeyId: string;
  Expiration: string;
  SecretAccessKey: string;
}

export interface CreConfigOutput {
  path: string;
  format: string;
  credentials: CreConfigOutputCredentials;
  asset: string;
  open_on_complete: boolean;
  as_geo: boolean;
  ancillary: any[];
  with_checksum: boolean;
  with_validation: boolean;
  region: string;
}

export interface CreConfig {
  container_image: string;
  poly: any[];
  container_name: string;
  timeout: number;
  rqst_timeout: number;
  environment_version: string;
  build_information: string;
  samples: any[];
  resources: any[];
  node_timeout: number;
  key_space: number;
  region_mask: CreConfigRegionMask;
  raster: CreConfigRaster;
  container_command: string;
  points_in_polygon: number;
  read_timeout: number;
  output: CreConfigOutput;
  proj: string;
  resource: string;
  cluster_size_hint: number;
  sliderule_version: string;
}

export interface BathyConfigPhoreal {
  geoloc: string;
  use_abs_h: boolean;
  send_waveform: boolean;
  binsize: number;
  above_classifier: boolean;
}

export interface BathyConfigFit {
  sigma_r_max: number;
  maxi: number;
  H_min_win: number;
}

export interface BathyConfigAtl24 {
  class_ph: string[];
  compact: boolean;
  invalid_kd: string[];
  confidence_threshold: number;
  sensor_depth_exceeded: string[];
  night: string[];
  low_confidence: string[];
  anc_fields: any[];
  invalid_wind_speed: string[];
}

export interface BathyConfigSurface {
  min_peak_separation: number;
  max_bins: number;
  surace_width: number;
  model_as_poisoon: boolean;
  signal_threshold: number;
  bin_size: number;
  highest_peak_ration: number;
  max_range: number;
}

export interface BathyConfigYapc {
  score: number;
  version: number;
  win_x: number;
  win_h: number;
  knn: number;
  min_knn: number;
}

export interface BathyConfigRegionMask {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface BathyConfigGranule {
  month: number;
  version: number;
  year: number;
  cycle: number;
  rgt: number;
  day: number;
  region: number;
}

export interface BathyConfigUncertainty {
  asset_kd: string;
}

export interface BathyConfigRaster {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface BathyConfigOutputCredentials {
  AccessKeyId: string;
  expiration: string;
  secretAccessKey: string;
  Token: string;
  aws_session_token: string;
  aws_secret_access_key: string;
  aws_access_key_id: string;
  sessionToken: string;
  accessKeyId: string;
  Expiration: string;
  SecretAccessKey: string;
}

export interface BathyConfigOutput {
  path: string;
  format: string;
  credentials: BathyConfigOutputCredentials;
  asset: string;
  open_on_complete: boolean;
  as_geo: boolean;
  ancillary: any[];
  with_checksum: boolean;
  with_validation: boolean;
  region: string;
}

export interface BathyConfigRefraction {
  use_water_ri_mask: boolean;
  ri_water: number;
  ri_air: number;
}

export interface BathyConfig {
  cnf: string[];
  atl08_class: any[];
  phoreal: BathyConfigPhoreal;
  min_geoid_delta: number;
  srt: string;
  points_in_polygon: number;
  fit: BathyConfigFit;
  environment_version: string;
  resources: any[];
  node_timeout: number;
  asset09: string;
  quality_ph: string[];
  key_space: number;
  H_min_win: number;
  ph_in_extent: number;
  dist_in_seg: boolean;
  spots: number[];
  track: number;
  atl03_geo_fields: any[];
  atl24: BathyConfigAtl24;
  atl03_ph_fields: any[];
  min_dem_delta: number;
  surface: BathyConfigSurface;
  sliderule_version: string;
  len: number;
  yapc: BathyConfigYapc;
  region_mask: BathyConfigRegionMask;
  poly: any[];
  granule: BathyConfigGranule;
  timeout: number;
  rqst_timeout: number;
  cnt: number;
  build_information: string;
  proj: string;
  max_geoid_delta: number;
  res: number;
  atl06_fields: any[];
  beams: string[];
  read_timeout: number;
  maxi: number;
  use_bathy_mask: boolean;
  ats: number;
  atl03_corr_fields: any[];
  uncertainty: BathyConfigUncertainty;
  max_dem_delta: number;
  pass_invalid: boolean;
  atl08_fields: any[];
  raster: BathyConfigRaster;
  atl13_fields: any[];
  asset: string;
  samples: any[];
  cluster_size_hint: number;
  output: BathyConfigOutput;
  sigma_r_max: number;
  resource: string;
  generate_ndwi: boolean;
  refraction: BathyConfigRefraction;
}

export interface CoreConfigRegionMask {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface CoreConfigRaster {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface CoreConfigOutputCredentials {
  AccessKeyId: string;
  expiration: string;
  secretAccessKey: string;
  Token: string;
  aws_session_token: string;
  aws_secret_access_key: string;
  aws_access_key_id: string;
  sessionToken: string;
  accessKeyId: string;
  Expiration: string;
  SecretAccessKey: string;
}

export interface CoreConfigOutput {
  path: string;
  format: string;
  credentials: CoreConfigOutputCredentials;
  asset: string;
  open_on_complete: boolean;
  as_geo: boolean;
  ancillary: any[];
  with_checksum: boolean;
  with_validation: boolean;
  region: string;
}

export interface CoreConfig {
  poly: any[];
  timeout: number;
  rqst_timeout: number;
  environment_version: string;
  build_information: string;
  samples: any[];
  resources: any[];
  node_timeout: number;
  key_space: number;
  region_mask: CoreConfigRegionMask;
  raster: CoreConfigRaster;
  sliderule_version: string;
  proj: string;
  output: CoreConfigOutput;
  points_in_polygon: number;
  resource: string;
  cluster_size_hint: number;
  read_timeout: number;
}

export interface Icesat2ConfigPhoreal {
  geoloc: string;
  use_abs_h: boolean;
  send_waveform: boolean;
  binsize: number;
  above_classifier: boolean;
}

export interface Icesat2ConfigYapc {
  score: number;
  version: number;
  win_x: number;
  win_h: number;
  knn: number;
  min_knn?: number;
}

export interface Icesat2ConfigOutputCredentials {
  AccessKeyId: string;
  expiration: string;
  secretAccessKey: string;
  Token: string;
  aws_session_token: string;
  aws_secret_access_key: string;
  aws_access_key_id: string;
  sessionToken: string;
  accessKeyId: string;
  Expiration: string;
  SecretAccessKey: string;
}

export interface Icesat2ConfigOutput {
  path: string;
  format: string;
  credentials: Icesat2ConfigOutputCredentials;
  asset: string;
  open_on_complete: boolean;
  as_geo: boolean;
  ancillary: any[];
  with_checksum: boolean;
  with_validation: boolean;
  region: string;
}

export interface Icesat2ConfigFit {
  sigma_r_max: number;
  maxi: number;
  H_min_win: number;
}

export interface Icesat2ConfigRegionMask {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface Icesat2ConfigRaster {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface Icesat2ConfigAtl24 {
  class_ph: string[];
  compact: boolean;
  invalid_kd: string[];
  confidence_threshold: number;
  sensor_depth_exceeded: string[];
  night: string[];
  low_confidence: string[];
  anc_fields: any[];
  invalid_wind_speed: string[];
}

export interface Icesat2ConfigGranule {
  month: number;
  version: number;
  year: number;
  cycle: number;
  rgt: number;
  day: number;
  region: number;
}

export interface Icesat2Config {
  atl13_fields: any[];
  atl08_class: any[];
  phoreal: Icesat2ConfigPhoreal;
  srt: string;
  dist_in_seg: boolean;
  resources: any[];
  node_timeout: number;
  key_space: number;
  track: number;
  proj: string;
  cnf: string[];
  samples: any[];
  resource: string;
  yapc: Icesat2ConfigYapc;
  quality_ph: string[];
  poly: any[];
  H_min_win: number;
  points_in_polygon: number;
  rqst_timeout: number;
  output: Icesat2ConfigOutput;
  build_information: string;
  atl03_geo_fields: any[];
  fit: Icesat2ConfigFit;
  res: number;
  atl03_ph_fields: any[];
  beams: string[];
  timeout: number;
  maxi: number;
  environment_version: string;
  ats: number;
  atl03_corr_fields: any[];
  cluster_size_hint: number;
  pass_invalid: boolean;
  region_mask: Icesat2ConfigRegionMask;
  cnt: number;
  raster: Icesat2ConfigRaster;
  atl24: Icesat2ConfigAtl24;
  sliderule_version: string;
  asset: string;
  read_timeout: number;
  granule: Icesat2ConfigGranule;
  sigma_r_max: number;
  atl08_fields: any[];
  atl06_fields: any[];
  len: number;
}

export interface SwotConfigRegionMask {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface SwotConfigRaster {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface SwotConfigOutputCredentials {
  AccessKeyId: string;
  expiration: string;
  secretAccessKey: string;
  Token: string;
  aws_session_token: string;
  aws_secret_access_key: string;
  aws_access_key_id: string;
  sessionToken: string;
  accessKeyId: string;
  Expiration: string;
  SecretAccessKey: string;
}

export interface SwotConfigOutput {
  path: string;
  format: string;
  credentials: SwotConfigOutputCredentials;
  asset: string;
  open_on_complete: boolean;
  as_geo: boolean;
  ancillary: any[];
  with_checksum: boolean;
  with_validation: boolean;
  region: string;
}

export interface SwotConfig {
  poly: any[];
  timeout: number;
  rqst_timeout: number;
  environment_version: string;
  build_information: string;
  samples: any[];
  variables: any[];
  node_timeout: number;
  key_space: number;
  region_mask: SwotConfigRegionMask;
  raster: SwotConfigRaster;
  sliderule_version: string;
  points_in_polygon: number;
  proj: string;
  output: SwotConfigOutput;
  resources: any[];
  resource: string;
  cluster_size_hint: number;
  read_timeout: number;
}

export interface GediConfigRegionMask {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface GediConfigRaster {
  lonmin: number;
  latmin: number;
  geojson: string;
  cellsize: number;
  latmax: number;
  cols: number;
  lonmax: number;
  rows: number;
}

export interface GediConfigOutputCredentials {
  AccessKeyId: string;
  expiration: string;
  secretAccessKey: string;
  Token: string;
  aws_session_token: string;
  aws_secret_access_key: string;
  aws_access_key_id: string;
  sessionToken: string;
  accessKeyId: string;
  Expiration: string;
  SecretAccessKey: string;
}

export interface GediConfigOutput {
  path: string;
  format: string;
  credentials: GediConfigOutputCredentials;
  asset: string;
  open_on_complete: boolean;
  as_geo: boolean;
  ancillary: any[];
  with_checksum: boolean;
  with_validation: boolean;
  region: string;
}

export interface GediConfig {
  l4_quality_filter: boolean;
  poly: any[];
  surface_flag: number;
  rqst_timeout: number;
  degrade_flag: number;
  build_information: string;
  samples: any[];
  degrade_filter: boolean;
  points_in_polygon: number;
  beams: string[];
  l2_quality_flag: number;
  environment_version: string;
  resources: any[];
  beam: string[];
  node_timeout: number;
  proj: string;
  key_space: number;
  region_mask: GediConfigRegionMask;
  cluster_size_hint: number;
  raster: GediConfigRaster;
  l2_quality_filter: boolean;
  sliderule_version: string;
  timeout: number;
  read_timeout: number;
  output: GediConfigOutput;
  l4_quality_flag: number;
  resource: string;
  anc_fields: any[];
  surface_filter: boolean;
}