import { defineStore } from 'pinia'
import type { SrMultiSelectTextItem } from '@/components/SrMultiSelectText.vue';
import type { SrMultiSelectNumberItem } from '@/components/SrMultiSelectNumber.vue';
import type { SrMenuMultiCheckInputOption } from '@/components/SrMenuMultiCheckInput.vue';
import type { AtlReqParams, AtlpReqParams, SrRegion, OutputFormat } from '@/sliderule/icesat2';
import { getBeamsAndTracksWithGts } from '@/utils/parmUtils';
import { type SrListNumberItem } from '@/stores/atlChartFilterStore';
import { useMapStore } from '@/stores/mapStore';
import { calculatePolygonArea } from "@/composables/SrTurfUtils";
import { convertTimeFormat } from '@/utils/parmUtils';

export interface NullReqParams {
  null: null;
}

export type ReqParams = AtlReqParams | AtlpReqParams | NullReqParams;

interface YapcConfig {
  version: number;
  score: number;
  knn?: number; // Optional property
  win_h?: number; // Optional property
  win_x?: number; // Optional property
}

export const useReqParamsStore = defineStore('reqParams', {

    state: () => ({
        missionValue: 'ICESat-2' as string,
        missionItems:['ICESat-2','GEDI'] as string[],
        iceSat2SelectedAPI: 'atl06' as string,
        iceSat2APIsItems: ['atl06','atl03','atl08','atl24'] as string[],
        gediSelectedAPI: 'gedi01b' as string,
        gediAPIsItems: ['gedi01b','gedi02a','gedi04a'] as string[],
        using_worker: false,
        asset: 'icesat2',
        isArrowStream: false,
        isFeatherStream: false,
        rasterizePolyCellSize: 0.0001,
        ignorePolygon: false,
        poly: null as SrRegion | null,
        convexHull: null as SrRegion | null,
        areaOfConvexHull: 0.0 as number, // in square kilometers
        areaWarningThreshold: 1000.0 as number, // in square kilometers
        areaErrorThreshold: 10000.0 as number, // in square kilometers
        urlValue: 'slideruleearth.io',
        enableGranuleSelection: false,
        tracks: [] as SrListNumberItem[],
        selectAllTracks: false,
        beams: [] as SrListNumberItem[],
        selectAllBeams: false,
        useRGT: false,
        rgtValue: 1,
        useCycle: false,
        cycleValue: 1,
        useRegion: false,
        regionValue: 1,
        useTime: false,
        t0Value: new Date,
        t1Value: new Date,
        totalTimeoutValue: 600,
        useReqTimeout: false,
        reqTimeoutValue: 600,
        useNodeTimeout: false,
        nodeTimeoutValue: 600,
        useReadTimeout: false,
        readTimeoutValue: 600,
        lengthValue: -1.0,
        stepValue: -1.0,
        confidenceValue: 4,
        iterationsValue: 6,
        spreadValue: 20.0,
        PE_CountValue: 10,
        windowValue: 3.0,
        sigmaValue: 5.0,
        enableAtl03Confidence: false,
        surfaceReferenceTypeOptions: [
          { name: 'Dynamic', value: -1 },
          { name: 'Land', value: 0 },
          { name: 'Ocean', value: 1 },
          { name: 'Sea Ice', value: 2 },
          { name: 'Land Ice', value: 3 },
          { name: 'Inland Water',value: 4 },
        ] as SrMultiSelectNumberItem[],
        surfaceReferenceType:[] as number[],
        signalConfidenceOptions: 
        [
          { name: 'TEP', value: 'atl03_tep' },
          { name: 'Not Considered', value: 'atl03_not_considered' },
          { name: 'Background', value: 'atl03_background' },
          { name: 'Within 10m', value: 'atl03_within_10m' },
          { name: 'Low', value: 'atl03_low' },
          { name: 'Medium', value: 'atl03_medium' },
          { name: 'High', value: 'atl03_high' },
        ] as SrMultiSelectTextItem[],
        signalConfidence: [],
        signalConfidenceNumberOptions: 
        [
          { name: 'TEP', value: -2 },
          { name: 'Not Considered', value: -1 },
          { name: 'Background', value: 0 },
          { name: 'Within 10m', value: 1 },
          { name: 'Low', value: 2 },
          { name: 'Medium', value: 3 },
          { name: 'High', value: 4 },
        ] as SrMultiSelectNumberItem[],
        signalConfidenceNumber: [ 0,1,2,3,4 ],
        qualityPHOptions: [
          { name: 'Nominal', value: 0 },
          { name: 'Possible Afterpulse', value: 1 },
          { name: 'Possible Impulse Response Effect', value: 2 },
          { name: 'Possible TEP', value: 3 },
        ] as SrMultiSelectNumberItem[],
        qualityPHNumber: [0],
        enableAtl08Classification: false,
        atl08LandTypeOptions: [
          {name:'Noise', value:'atl08_noise'}, 
          {name:'Ground', value: 'atl08_ground'},
          {name:'Canopy', value:'atl08_canopy'},
          {name:'Top of Canopy', value:'atl08_top_of_canopy'},
          {name:'Unclassified', value:'atl08_unclassified'},
          ] as SrMultiSelectTextItem[], 
        atl08LandType: [] as string[],
        distanceInOptions:[
          { name: 'meters', value: 'meters' },
          { name: 'segments', value: 'segments' },
        ] as SrMultiSelectTextItem[],
        distanceIn: { name: 'meters', value: 'meters' },
        passInvalid: false,
        alongTrackSpread: -1.0,
        minimumPhotonCount: -1,
        maxIterations: -1,
        minWindowHeight: -1.0,
        maxRobustDispersion: 0.0,
        binSize: 0.0,
        geoLocation: {name: "mean", value: "mean"},
        geoLocationOptions: [
          { name: 'mean', value: 'mean' },
          { name: 'median', value: 'median' },
          { name: 'center', value: 'center' },
        ] as SrMultiSelectTextItem[],
        useAbsoluteHeights: false,
        sendWaveforms: false,
        useABoVEClassifier: false,
        gediBeams: [0,1,2,3,5,6,8,11] as number[],
        gediBeamsOptions: [
          {name:'0',value:0}, 
          {name:'1',value:1},
          {name:'2',value:2},
          {name:'3',value:3},
          {name:'5',value:5},
          {name:'6',value:6},
          {name:'8',value:8},
          {name:'11',value:11},
        ] as SrMultiSelectNumberItem[],

        ATL03GeoSpatialFieldsOptions:['Field_1', 'Field_2', 'Field_3'],
        ATL03PhotonFieldsOptions:['Field_1', 'Field_2', 'Field_3'],
        ATL06IceSegmentFieldsOptions:['Field_1', 'Field_2', 'Field_3'],
        ATL08LandSegmentFieldsOptions:[
          { label: 'Option 1', value: 'opt1', selected: false, additionalParameter: false },
          { label: 'Option 2', value: 'opt2', selected: false, additionalParameter: false },
          { label: 'Option 3', value: 'opt3', selected: false, additionalParameter: false },
        ] as SrMenuMultiCheckInputOption[],
        degradeFlag: false,
        l2QualityFlag: false,
        l4QualityFlag: false,
        surfaceFlag: false,
        fileOutput: true, // always fetch data as a parquet file
        staged: false,
        outputFormat: {name:"parquet", value:"parquet"},
        outputFormatOptions: [ // TBD. Alway fet data as a parquet file. This will eventually be used for an Export feature
          {name:"feather", value:"feather"},
          {name:"geoparquet", value:"geoparquet"},
          {name:"parquet", value:"parquet"},
          {name:"csv", value:"csv"},
        ],
        outputLocation: {name:"local", value:"local"},
        outputLocationOptions: [
          {name:"local", value:"local"},
          {name:"S3", value:"S3"},
        ],
        outputLocationPath: '',
        awsRegion: {name:"us-west-2", value:"us-west-2"},
        awsRegionOptions: [
          {name:"us-west-2", value:"us-west-2"},
          {name:"us-west-1", value:"us-west-1"},
          {name:"us-east-2", value:"us-east-2"},
          {name:"us-east-1", value:"us-east-1"},
          {name:"eu-west-1", value:"eu-west-1"},
          {name:"eu-west-2", value:"eu-west-2"},
          {name:"eu-central-1", value:"eu-central-1"},
          {name:"ap-southeast-1", value:"ap-southeast-1"},
          {name:"ap-southeast-2", value:"ap-southeast-2"},
          {name:"ap-northeast-1", value:"ap-northeast-1"},
          {name:"ap-northeast-2", value:"ap-northeast-2"},
          {name:"ap-south-1", value:"ap-south-1"},
          {name:"sa-east-1", value:"sa-east-1"},
        ],
        enableYAPC: false,
        useYAPCScore: false,
        YAPCScore: 0.0,
        usesYAPCKnn: false,
        YAPCKnn: 0,
        usesYAPCWindowHeight: false,
        YAPCWindowHeight: 0.0,
        usesYAPCWindowWidth: false,
        YAPCWindowWidth: 0.0,
        usesYAPCVersion: false,
        YAPCVersion: '0' as string,
        YAPCVersionOptions: ['0','1','2','3'],
        resources: [] as string[],
        target_numAtl06Recs: 0,
        target_numAtl06pRecs: 0,
        useChecksum: false,
    }),
    actions: {
        getRasterizePolyCellSize() {
            return this.rasterizePolyCellSize;
        },
        setRasterizePolyCellSize(value:number) {
            this.rasterizePolyCellSize = value;
        },
        addResource(resource: string) {
          if (resource.trim().length) {
            this.resources.push(resource);
          }
        },
        removeResource(index: number) {
          this.resources.splice(index, 1);
        },
        getAtlReqParams(req_id: number): AtlReqParams { 
          const getOutputPath = (): string => {
            let path = this.outputLocationPath;
            if (this.outputLocation.value === 'S3') {
              path = `s3://${this.outputLocationPath}`;
            }
            if (this.outputLocationPath.length === 0) {
              //Note: This is only used by the server. It needs to be unique for each request.
              // We create a similar filename for our local client elsewhere.
              path = `${this.iceSat2SelectedAPI}_${req_id}_SVR_TMP_${new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-').replace(/T/g, '-').replace(/Z/g, '')}`;
            }
            return path;
          };
        
          const getOutputFormat = (path: string): OutputFormat | undefined => {
            if (this.outputFormat.value === 'geoparquet' || this.outputFormat.value === 'parquet') {
              path += '.parquet';
              return {
                format: 'parquet',
                as_geo: this.outputFormat.value === 'geoparquet',
                path: path,
                with_checksum: this.useChecksum,
              };
            }
            console.error('getAtlReqParams: outputFormat not recognized:', this.outputFormat.value);
            return undefined;
          };
        
          const req: AtlReqParams = {
            asset: this.asset,
          }
          if (this.surfaceReferenceType.length===1 &&  this.surfaceReferenceType[0]===-1){
            req.srt = -1;
          } else {
            req.srt = this.getSrt();
          }
          if(this.signalConfidence.length>0){
            req.cnf = this.signalConfidence;
          }
          if(this.getMinWindowHeight() >= 0.0){
            req.win = this.getMinWindowHeight();
          }
          if(this.getLengthValue() >= 0.0){
            req.len = this.getLengthValue();
          }
          if(this.getStepValue() >= 0.0){
            req.res = this.getStepValue();
          }
          if(this.getSigmaValue() >= 0.0){
            req.sigma_r_max = this.getSigmaValue();
          }
          if(this.getMaxIterations() > 0){
            req.maxi = this.getMaxIterations();
          }
          if(this.poly && !this.ignorePolygon) {
            req.poly = this.poly;
          }
          if(this.passInvalid) {
            req.pass_invalid = true;
          } else {
            if(this.getAlongTrackSpread() >= 0.0){
              req.ats = this.alongTrackSpread;
            }
            if(this.minimumPhotonCount > 0){ 
              req.cnt = this.minimumPhotonCount;
            }
          }

          if (this.fileOutput) {
            const path = getOutputPath();
            const output = getOutputFormat(path);
            if (output) {
              req.output = output;
              this.isArrowStream = true;
            }
          }
        
          if (this.getEnableGranuleSelection()) {
            if (this.tracks.length > 0) {
              req.tracks = this.tracks.map(track => track.value);
            }
            if (this.beams.length > 0) {
              req.beams = this.beams.map(beam => beam.value);
            }
            if(this.getUseRgt()){
              req.rgt = this.getRgt();
            }
            if(this.getUseCycle()){
              req.cycle = this.getCycle();
            }
            if(this.getUseRegion()){
              req.region = this.getRegion();
            }
            if(this.getT0()){
              req.t0 = convertTimeFormat(this.getT0(),'%Y-%m-%dT%H:%M:%SZ');
            }
            if(this.getT1()){
              req.t1 = convertTimeFormat(this.getT1(),'%Y-%m-%dT%H:%M:%SZ');
            }
          }
          if(this.enableAtl03Confidence) {
            req.quality_ph = this.qualityPHNumber;
          }

          if(this.enableAtl08Classification) {
            req.alt08_class = this.atl08LandType;
          }
          if(this.enableYAPC) {
            const yapc:YapcConfig = {
              version: Number(this.getYAPCVersion()),
              score: this.getYAPCScore(),
            };
            if(this.usesYAPCKnn) {
              yapc.knn = this.YAPCKnn
            }
            if(this.usesYAPCWindowHeight) {
              yapc.win_h= this.YAPCWindowHeight
            }
            req.yapc = yapc;
          }
          if (this.poly && this.convexHull) {
            req.cmr = { polygon: this.convexHull };
          }
          if(useMapStore().getPolySource()=='Upload geojson File' && this.poly) {
            req.raster = {
              data: this.poly,
              length: this.poly.length,
              cellsize: this.getRasterizePolyCellSize(),
            }
          }
          if(this.distanceIn.value === 'segments') {
            req.dist_in_seg = true;
          }
          // if(this.useGlobalTimeout()) {
          //   req.timeout = this.totalTimeoutValue
          // } else {
          if(this.useReqTimeout) {
            req['rqst-timeout'] = this.reqTimeoutValue;
          }
          if(this.useNodeTimeout) {
            req['node-timeout'] = this.nodeTimeoutValue;
          }
          if(this.useReadTimeout) {
            req['read-timeout'] = this.readTimeoutValue;
          }
          //}
          return req;
        },
        setSrt(srt:number[]) {
          this.surfaceReferenceType = srt;
        },
        getSrt(): number[] {
          return this.surfaceReferenceType;       
        },
        getSurfaceReferenceType(name: string): number {
          const option = this.surfaceReferenceTypeOptions.find(option => option.name === name);
          return option ? option.value : -1;
        },
        getAtlpReqParams(req_id: number): AtlpReqParams {
          const baseParams:AtlpReqParams = {
            parms: this.getAtlReqParams(req_id),
          };
      
          if (this.resources.length > 0) {
            baseParams['resources'] = this.resources;
          }
          return baseParams;
        },
        getEnableGranuleSelection(): boolean {
          return this.enableGranuleSelection;
        },
        setEnableGranuleSelection(enableGranuleSelection:boolean) {
          this.enableGranuleSelection = enableGranuleSelection;
        },
        getUseRgt() : boolean {
            return this.useRGT;
        },
        setUseRgt(useRGT:boolean) {
            this.useRGT = useRGT;
        },
        setRgt(rgtValue:number) {
          this.rgtValue = rgtValue;
        },
        getRgt(): number {
          return this.rgtValue;
        },
        setUseCycle(useCycle:boolean) {
            this.useCycle = useCycle;
        },
        getUseCycle() : boolean {
            return this.useCycle;
        },
        setCycle(cycleValue:number) {
          this.cycleValue = cycleValue;
        },
        getCycle() : number {
          return this.cycleValue;
        },
        setUseRegion(useRegion:boolean) {
            this.useRegion = useRegion;
        },
        getUseRegion(): boolean {
            return this.useRegion;
        },
        setRegion(regionValue:number) {
          this.regionValue = regionValue;
        },
        getRegion(): number {
          return this.regionValue;
        },
        setT0(t0Value:Date) {
          this.t0Value = t0Value;
        },
        getT0(): Date {
          return this.t0Value;
        },
        setT1(t1Value:Date) {
          this.t1Value = t1Value;
        },
        getT1(): Date {
          return this.t1Value;
        },
        setBeams(beams: SrListNumberItem[]) {
          this.beams = beams;
        },
        getBeams(): SrListNumberItem[] {
          return this.beams;
        },
        getBeamValues(): number[] { 
          return this.beams.map(beam => beam.value);
        },
        setBeamsAndTracksWithGts(gts:SrListNumberItem[]) {
          console.log('setBeamsAndTracksWithGts:', gts);
          const parms = getBeamsAndTracksWithGts(gts);
          this.setBeams(parms.beams);
          this.setTracks(parms.tracks);
        },
        setTracks(tracks: SrListNumberItem[]) {
          this.tracks = tracks;
        },
        getTracks() {
          return this.tracks;
        },
        setSelectAllTracks(selectAllTracks:boolean) {
          this.selectAllTracks = selectAllTracks;
        },
        getSelectAllTracks() {
          return this.selectAllTracks;
        },
        setSelectAllBeams(selectAllBeams:boolean) {
          this.selectAllBeams = selectAllBeams;
        },
        getSelectAllBeams(): boolean {
          return this.selectAllBeams;
        },
        setUseChecksum(useChecksum:boolean) {
          this.useChecksum = useChecksum;
        },
        getUseChecksum(): boolean {
          return this.useChecksum;
        },
        getPassInvalid(): boolean {
          return this.passInvalid;
        },
        setPassInvalid(passInvalid:boolean) {
          this.passInvalid = passInvalid;
        },
        setAsset(asset:string) {
          this.asset = asset;
        },
        getAsset(): string {
          return this.asset;
        },
        // initParmsForGenUser() {
        //   this.asset = 'icesat2';
        //   this.surfaceReferenceType = [-1];
        //   this.signalConfidenceNumber = [4];
        //   this.alongTrackSpread = 20.0;
        //   this.minimumPhotonCount = 10;
        //   this.maxIterations = 6;
        //   this.minWindowHeight = 3.0;
        //   this.sigmaValue = 5.0;
        //   this.fileOutput = true;
        //   this.outputFormat = {name:"parquet", value:"parquet"};
        //   this.useChecksum = false;
        //   this.stepValue = 20.0;
        //   this.lengthValue = 40.0;
        //   this.outputLocationPath=''; // forces auto creation of a unique path
        // },
        getMinWindowHeight():number {
          return this.minWindowHeight;
        },
        setMinWindowHeight(minWindowHeight:number) {
          this.minWindowHeight = minWindowHeight;
        },
        getLengthValue(): number {
          return this.lengthValue;
        },
        setLengthValue(lengthValue:number) {
          this.lengthValue = lengthValue;
        },
        getStepValue(): number {
          return this.stepValue;
        },
        setStepValue(stepValue:number) {
          this.stepValue = stepValue;
        },
        getSigmaValue(): number {
          return this.sigmaValue;
        },
        setSigmaValue(sigmaValue:number) {
          this.sigmaValue = sigmaValue;
        },
        getMaxIterations():number {
          return this.maxIterations;
        },
        setMaxIterations(maxIterations:number) {
          this.maxIterations = maxIterations;
        },
        getAlongTrackSpread():number {
          return this.alongTrackSpread;
        },
        setAlongTrackSpread(alongTrackSpread:number) {
          this.alongTrackSpread = alongTrackSpread;
        },
        getMinimumPhotonCount(): number {
          return this.minimumPhotonCount;
        },
        setMinimumPhotonCount(minimumPhotonCount:number) {
          this.minimumPhotonCount = minimumPhotonCount;
        },
        setUseReqTimeout(useReqTimeout:boolean) {
          this.useReqTimeout = useReqTimeout;
        },
        getUseReqTimeout(): boolean {
          return this.useReqTimeout;
        },
        setReqTimeout(reqTimeoutValue:number) {
          this.reqTimeoutValue = reqTimeoutValue;
        },
        getReqTimeout(): number {
          return this.reqTimeoutValue;
        },
        setUseNodeTimeout(useNodeTimeout:boolean) {
          this.useNodeTimeout = useNodeTimeout;
        },
        getUseNodeTimeout(): boolean {
          return this.useNodeTimeout;
        },
        setNodeTimeout(nodeTimeoutValue:number) {
          this.nodeTimeoutValue = nodeTimeoutValue;
        },
        getNodeTimeout(): number {
          return this.nodeTimeoutValue;
        },
        setUseReadTimeout(useReadTimeout:boolean) {
          this.useReadTimeout = useReadTimeout;
        },
        getUseReadTimeout(): boolean {
          return this.useReadTimeout;
        },
        getReadTimeout(): number {
          return this.readTimeoutValue;
        },
        setReadTimeout(readTimeoutValue:number) {
          this.readTimeoutValue = readTimeoutValue;
        },
        restoreTimeouts() {
          this.totalTimeoutValue = 600;
          this.useReqTimeout = false;
          this.useNodeTimeout = false;
          this.useReadTimeout = false;
        },
        // useGlobalTimeout(): boolean {
        //   return (!this.useReqTimeout && !this.useNodeTimeout && !this.useReadTimeout);
        // },
        getYAPCScore():number {
          return this.YAPCScore;
        },
        setYAPCScore(value:number) {
          this.YAPCScore = value;
        },
        getUseYAPCScore():boolean {
          return this.useYAPCScore;
        },
        setUseYAPCScore(value:boolean) {
          this.useYAPCScore = value;
        },
        getUseYAPCKnn():boolean {
          return this.usesYAPCKnn;
        },
        setUseYAPCKnn(value:boolean) {
          this.usesYAPCKnn = value;
        },
        getYAPCKnn():number {
          return this.YAPCKnn;
        },
        setYAPCKnn(value:number) {
          this.YAPCKnn = value;
        },
        getYAPCWindowHeight() {
          return this.YAPCWindowHeight;
        },
        setYAPCWindowHeight(value:number) {
          this.YAPCWindowHeight = value;
        },
        getUsesYAPCWindowWidth() {
          return this.usesYAPCWindowWidth;
        },
        setUsesYAPCWindowWidth(value:boolean) {
          this.usesYAPCWindowWidth = value;
        },
        getUsesYAPCWindowHeight() {
          return this.usesYAPCWindowHeight;
        },
        setUsesYAPCWindowHeight(value:boolean) {
          this.usesYAPCWindowHeight = value;
        },
        getYAPCWindowWidth() {
          return this.YAPCWindowWidth;
        },
        setYAPCWindowWidth(value:number) {
          this.YAPCWindowWidth = value;
        },
        getYAPCVersion():string {
          return this.YAPCVersion;
        },
        setYAPCVersion(value:string) {
          this.YAPCVersion = value;
        },
        getMissionValue() : string {
          return this.missionValue;
        },
        setMissionValue(value:string) {
          if (value === 'ICESat-2') {
              this.iceSat2SelectedAPI = this.iceSat2APIsItems[0]; // Reset to default when mission changes
              this.asset ='icesat2';
          } else if (value === 'GEDI') {
              this.gediSelectedAPI = this.gediAPIsItems[0]; // Reset to default when mission changes
              this.asset ='gedi';
          }
          this.missionValue = value;
        },
        getMissionItems(): string[] {
          return this.missionItems;
        },
        getIceSat2API() : string {
          return this.iceSat2SelectedAPI;
        },
        setIceSat2API(value:string) {
          this.iceSat2SelectedAPI = value;
        },
        getGediAPI() : string {
          return this.gediSelectedAPI;
        },
        setGediAPI(value:string) {
          this.gediSelectedAPI = value;
        },
        setConvexHull(convexHull: SrRegion) {
          this.convexHull = convexHull;
          this.areaOfConvexHull = calculatePolygonArea(convexHull);
        },
        getConvexHull(): SrRegion|null {
          return this.convexHull;
        },
        getAreaOfConvexHull() : number {
          return this.areaOfConvexHull;
        },
        getFormattedAreaOfConvexHull(): string {
          return this.areaOfConvexHull.toFixed(2).toString()+" km²";
        },
        setAreaOfConvexHull(value:number) { 
          this.areaOfConvexHull = value;
        },
        getAreaWarningThreshold(): number {
          return this.areaWarningThreshold;
        },
        setAreaWarningThreshold(value:number) { 
          this.areaWarningThreshold = value;
        },
        getAreaErrorThreshold(): number {
          return this.areaErrorThreshold;
        },
        setAreaErrorThreshold(value:number) { 
          this.areaErrorThreshold = value;
        },
    },
})


