import type {
    SrRegion,
    OutputFormat,
    SrMenuNumberItem,
    SrRadioItem,
    Atl13,
    SrListNumberItem,
    SrListStringItem,
    SrMultiSelectNumberItem,
    SrMultiSelectTextItem,
    SrMenuItem,
    SrPhoReal,
} from '@/types/SrTypes';

export interface SrReqParamsState {
    missionValue: string;
    iceSat2SelectedAPI: string;
    gediSelectedAPI: string;
    using_worker: boolean;
    asset: string;
    isArrowStream: boolean;
    isFeatherStream: boolean;
    rasterizePolyCellSize: number;
    ignorePolygon: boolean;
    poly: SrRegion | null;
    convexHull: SrRegion | null;
    areaOfConvexHull: number;
    urlValue: string;
    enableGranuleSelection: boolean;
    tracks: SrListNumberItem[];
    selectAllTracks: boolean;
    beams: SrListNumberItem[];
    selectAllBeams: boolean;
    useRGT: boolean;
    rgtValue: number;
    useCycle: boolean;
    cycleValue: number;
    useRegion: boolean;
    regionValue: number;
    useTime: boolean;
    gpsToUTCOffset: number;
    minDate: Date;
    t0Value: Date;
    t1Value: Date;
    useServerTimeout: boolean;
    serverTimeoutValue: number;
    useReqTimeout: boolean;
    reqTimeoutValue: number;
    useNodeTimeout: boolean;
    nodeTimeoutValue: number;
    useReadTimeout: boolean;
    readTimeoutValue: number;
    useLength: boolean;
    lengthValue: number;
    useStep: boolean;
    stepValue: number;
    confidenceValue: number;
    iterationsValue: number;
    spreadValue: number;
    PE_CountValue: number;
    windowValue: number;    
    enableAtl03Classification: boolean;
    surfaceReferenceType: SrMultiSelectNumberItem[];
    signalConfidenceNumber: number[];
    qualityPHNumber: number[];
    enableAtl08Classification: boolean;
    atl08LandType: string[];
    distanceIn: SrMenuItem;
    passInvalid: boolean;
    useAlongTrackSpread: boolean;
    alongTrackSpread: number;
    useMinimumPhotonCount: boolean;
    minimumPhotonCount: number;
    maxIterations: number;
    useMaxIterations: boolean;
    minWindowHeight: number;
    useMinWindowHeight: boolean;
    maxRobustDispersion: number;
    useMaxRobustDispersion: boolean;
    phoRealUseBinSize: boolean;
    useAbsoluteHeights: boolean;
    gediBeams: number[];
    sendWaveforms: boolean;
    useABoVEClassifier: boolean;
    degradeFlag: boolean;
    l2QualityFlag: boolean;
    l4QualityFlag: boolean;
    surfaceFlag: boolean;
    fileOutput: boolean;
    staged: boolean;
    fileOutputFormat: SrMenuItem;
    outputLocation: SrListStringItem;
    outputLocationPath: string;
    awsRegion: SrListStringItem;
    enableYAPC: boolean;
    useYAPCScore: boolean;
    YAPCScore: number;
    usesYAPCKnn: boolean;
    YAPCKnn: number;
    usesYAPCMinKnn: boolean;
    YAPCMinKnn: number;
    usesYAPCWindowHeight: boolean;
    YAPCWindowHeight: number;
    usesYAPCWindowWidth: boolean;
    YAPCWindowWidth: number;
    usesYAPCVersion: boolean;
    YAPCVersion: number;
    resources: string[];
    useChecksum: boolean;
    enableAtl24Classification: boolean;
    atl24_class_ph: string[];
    defaultsFetched: boolean;
    useDatum: boolean;
    useAtl24Compact: boolean;
    atl24Compact: boolean;
    useAtl24Classification: boolean;
    atl24Classification: number[];
    useAtl24ConfidenceThreshold: boolean;
    atl24ConfidenceThreshold: number;
    useAtl24InvalidKD: boolean;
    atl24InvalidKD: boolean;
    useAtl24InvalidWindspeed: boolean;
    atl24InvalidWindspeed: boolean;
    useAtl24LowConfidence: boolean;
    atl24LowConfidence: boolean;
    useAtl24Night: boolean;
    atl24Night: boolean;
    useAtl24SensorDepthExceeded: boolean;
    atl24SensorDepthExceeded: boolean;
    atl24AncillaryFields: string[];
    atl03AncillaryFields: string[];
    atl08AncillaryFields: string[];
    atl03_geo_fields: string[];
    atl03_corr_fields: string[];
    atl03_ph_fields: string[];
    atl06_fields: string[];
    atl08_fields: string[];
    atl13_fields: string[];
    gedi_fields: string[];
    useAtl13RefId: boolean;
    atl13: Atl13;
    phoreal: SrPhoReal;
    useAtl13Polygon: boolean;
    useAtl13Point: boolean;
    forcedAddedParams: Record<string, unknown>,
    forcedRemovedParams: string[],
    showParamsDialog: boolean;
}
