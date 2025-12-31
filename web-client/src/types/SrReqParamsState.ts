import type {
  SrRegion,
  Atl13,
  SrListNumberItem,
  SrListStringItem,
  SrMultiSelectNumberItem,
  SrMenuItem
} from '@/types/SrTypes'

export interface SrReqParamsState {
  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORTABLE API PARAMETERS
  // These fields are exported to the SlideRule server API request
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Region / Polygon ───
  poly: SrRegion | null
  convexHull: SrRegion | null
  areaOfConvexHull: number

  // ─── Granule Selection ───
  enableGranuleSelection: boolean
  tracks: SrListNumberItem[]
  beams: SrListNumberItem[]
  useRGT: boolean
  rgtValue: number
  useCycle: boolean
  cycleValue: number
  useRegion: boolean
  regionValue: number

  // ─── Time Range ───
  useTime: boolean
  t0Value: Date
  t1Value: Date

  // ─── Timeouts ───
  useServerTimeout: boolean
  serverTimeoutValue: number
  useReqTimeout: boolean
  reqTimeoutValue: number
  useNodeTimeout: boolean
  nodeTimeoutValue: number
  useReadTimeout: boolean
  readTimeoutValue: number

  // ─── Photon Processing Parameters ───
  useLength: boolean
  lengthValue: number
  useStep: boolean
  stepValue: number
  useAlongTrackSpread: boolean
  alongTrackSpread: number
  useMinimumPhotonCount: boolean
  minimumPhotonCount: number
  distanceIn: SrMenuItem
  passInvalid: boolean

  // ─── Surface Fit Algorithm ───
  useSurfaceFitAlgorithm: boolean
  maxIterations: number
  useMaxIterations: boolean
  minWindowHeight: number
  useMinWindowHeight: boolean
  maxRobustDispersion: number
  useMaxRobustDispersion: boolean

  // ─── ATL03 Classification ───
  enableAtl03Classification: boolean
  surfaceReferenceType: SrMultiSelectNumberItem[]
  signalConfidence: SrMultiSelectNumberItem[]
  qualityPH: SrMultiSelectNumberItem[]

  // ─── ATL08 Classification ───
  enableAtl08Classification: boolean
  atl08LandType: string[]

  // ─── ATL13 Parameters ───
  useAtl13RefId: boolean
  atl13: Atl13
  useAtl13Polygon: boolean
  useAtl13Point: boolean

  // ─── ATL24 Parameters ───
  enableAtl24Classification: boolean
  useDatum: boolean
  useAtl24Compact: boolean
  atl24Compact: boolean
  useAtl24Classification: boolean
  atl24_class_ph: string[]
  useAtl24ConfidenceThreshold: boolean
  atl24ConfidenceThreshold: number
  useAtl24InvalidKD: boolean
  atl24InvalidKD: string[]
  useAtl24InvalidWindspeed: boolean
  atl24InvalidWindspeed: string[]
  useAtl24LowConfidence: boolean
  atl24LowConfidence: string[]
  useAtl24Night: boolean
  atl24Night: string[]
  useAtl24SensorDepthExceeded: boolean
  atl24SensorDepthExceeded: string[]

  // ─── YAPC Parameters ───
  enableYAPC: boolean
  useYAPCScore: boolean
  YAPCScore: number
  usesYAPCKnn: boolean
  YAPCKnn: number
  usesYAPCMinKnn: boolean
  YAPCMinKnn: number
  usesYAPCWindowHeight: boolean
  YAPCWindowHeight: number
  usesYAPCWindowWidth: boolean
  YAPCWindowWidth: number
  usesYAPCVersion: boolean
  YAPCVersion: number

  // ─── PhoREAL Parameters ───
  enablePhoReal: boolean
  usePhoRealBinSize: boolean
  phoRealBinSize: number
  usePhoRealGeoLocation: boolean
  phoRealGeoLocation: string
  usePhoRealAbsoluteHeights: boolean
  usePhoRealSendWaveforms: boolean
  usePhoRealABoVEClassifier: boolean

  // ─── GEDI Parameters ───
  gediBeams: number[]
  degradeFlag: boolean
  l2QualityFlag: boolean
  l4QualityFlag: boolean
  surfaceFlag: boolean

  // ─── Ancillary Field Arrays ───
  atl24AncillaryFields: string[]
  atl03AncillaryFields: string[]
  atl08AncillaryFields: string[]
  atl03_geo_fields: string[]
  atl03_corr_fields: string[]
  atl03_ph_fields: string[]
  atl06_fields: string[]
  atl08_fields: string[]
  atl13_fields: string[]
  gedi_fields: string[]

  // ─── Resources ───
  resources: string[]
  useChecksum: boolean
  useMaxResources: boolean
  maxResourcesValue: number

  // ─── Advanced Parameter Editor ───
  forcedAddedParams: Record<string, unknown>
  forcedRemovedParams: string[]

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL UI STATE
  // These fields are NOT exported to the API - they control UI behavior only
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Mission & API Selection (UI only) ───
  missionValue: string
  iceSat2SelectedAPI: string
  gediSelectedAPI: string

  // ─── Internal Processing Flags (UI only) ───
  using_worker: boolean
  isFeatherStream: boolean
  defaultsFetched: boolean

  // ─── UI State Flags (UI only) ───
  polygonSource: 'polygon' | 'box' | 'upload' | null
  selectAllTracks: boolean
  selectAllBeams: boolean
  showParamsDialog: boolean
  ignorePolygon: boolean
  isAtl24PhotonOverlay: boolean

  // ─── Server & Output Configuration (UI only) ───
  urlValue: string
  rasterizePolyCellSize: number
  fileOutput: boolean
  staged: boolean
  outputLocation: SrListStringItem
  outputLocationPath: string
  isGeoParquet: boolean
  awsRegion: SrListStringItem

  // ─── Legacy UI Defaults (UI only) ───
  // These store default values for UI components
  gpsToUTCOffset: number
  minDate: Date
  confidenceValue: number
  iterationsValue: number
  spreadValue: number
  PE_CountValue: number
  windowValue: number
}
