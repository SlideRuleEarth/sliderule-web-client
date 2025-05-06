import { defineStore } from 'pinia'
import type { SrMultiSelectTextItem } from '@/components/SrMultiSelectText.vue';
import type { SrMultiSelectNumberItem } from '@/components/SrMultiSelectNumber.vue';
import type { SrMenuMultiCheckInputOption } from '@/components/SrMenuMultiCheckInput.vue';
import type { AtlReqParams, AtlxxReqParams, SrRegion, OutputFormat } from '@/sliderule/icesat2';
import { getGtsAndTracksWithGts } from '@/utils/parmUtils';
import { type SrListNumberItem } from '@/types/SrTypes';
import { useMapStore } from '@/stores/mapStore';
import { calculatePolygonArea } from "@/composables/SrTurfUtils";
import { convertTimeFormat } from '@/utils/parmUtils';
import { db } from '@/db/SlideRuleDb';
import { convexHull } from "@/composables/SrTurfUtils";
import { useGlobalChartStore } from './globalChartStore';
import { type ApiName, isValidAPI } from '@/types/SrTypes'
import { type Icesat2ConfigYapc } from '@/types/slideruleDefaultsInterfaces'
import { useSlideruleDefaults } from './defaultsStore';
interface YapcConfig {
  version: number;
  score: number;
  knn?: number; // Optional property
  win_h?: number; // Optional property
  win_x?: number; // Optional property
}

const createReqParamsStore = (id: string) => 
  defineStore(id, {
    state: () => ({
        missionValue: 'ICESat-2' as string,
        missionItems:['ICESat-2','GEDI'] as string[],
        iceSat2SelectedAPI: 'atl06p' as string,
        iceSat2APIsItems: ['atl06p','atl06sp','atl03x','atl03vp','atl08p','atl24x'] as string[],
        gediSelectedAPI: 'gedi01bp' as string,
        gediAPIsItems: ['gedi01bp','gedi02ap','gedi04ap'] as string[],
        using_worker: false,
        asset: 'icesat2',
        isArrowStream: false,
        isFeatherStream: false,
        rasterizePolyCellSize: 0.001,
        ignorePolygon: false,
        poly: null as SrRegion | null,
        convexHull: null as SrRegion | null,
        areaOfConvexHull: 0.0 as number, // in square kilometers
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
        gpsToUTCOffset: 18, // current leap seconds hack
        minDate: new Date('2018-10-01T00:00:00Z'),
        t0Value: new Date('2018-10-01T00:00:00Z'), // Sets to 2018-10-01 UTC, mission start
        t1Value: new Date(),
        useServerTimeout: false,
        serverTimeoutValue:  601, //600, 
        useReqTimeout: false,
        reqTimeoutValue: 601,//600, 
        useNodeTimeout: false,
        nodeTimeoutValue: 601,//600,
        useReadTimeout: false,
        readTimeoutValue: 601,
        //enableExtents: false,
        useLength:false,
        lengthValue: 40,
        useStep:false,
        stepValue: 20,
        confidenceValue: 4,
        iterationsValue: 6,
        spreadValue: 20.0,
        PE_CountValue: 10,
        windowValue: 3.0,
        enableAtl03Confidence: false,
        surfaceReferenceTypeOptions: [
          { name: 'Dynamic', value: -1 },
          { name: 'Land', value: 0 },
          { name: 'Ocean', value: 1 },
          { name: 'Sea Ice', value: 2 },
          { name: 'Land Ice', value: 3 },
          { name: 'Inland Water',value: 4 },
        ] as SrMultiSelectNumberItem[],
        surfaceReferenceType: [{ name: 'Dynamic', value: -1 }] as SrMultiSelectNumberItem[], 
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
        signalConfidenceNumber: [] as number[], 
        qualityPHOptions: [
          { name: 'Nominal', value: 0 },
          { name: 'Possible Afterpulse', value: 1 },
          { name: 'Possible Impulse Response Effect', value: 2 },
          { name: 'Possible TEP', value: 3 },
        ] as SrMultiSelectNumberItem[],
        qualityPHNumber: [],
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
        useAlongTrackSpread: false,
        alongTrackSpread: -1.0,
        useMinimumPhotonCount: false,
        minimumPhotonCount: -1,
        maxIterations: -1,
        minWindowHeight: -1.0,
        maxRobustDispersion: -1,
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
        degradeFlag: true,
        l2QualityFlag: true,
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
        YAPCVersion: 0 as number,
        YAPCVersionOptions: ['0','1','2','3'],
        resources: [] as string[],
        target_numAtl06Recs: 0,
        target_numAtl06pRecs: 0,
        useChecksum: false,
        enableSurfaceElevation: false,
        enableAtl24Classification: false,
        atl24_class_ph: ['unclassified', 'bathymetry', 'sea_surface'] as string[],
        atl24_class_ph_Options: ['unclassified', 'bathymetry', 'sea_surface'] as string[],
        defaultsFetched: false,
        useDatum: false,
        useAtl24Compact: false,
        atl24Compact: false,
        useAtl24Classification: false,
        atl24Classification: [40],
        atl24ClassOptions: [{name:'unclassified',value:0}, {name:'bathymetry',value:40} ,{ name:'sea_surface',value: 41}] as SrMultiSelectNumberItem[],
        useAtl24ConfidenceThreshold: false,
        atl24ConfidenceThreshold: 0.6, // NOTE: for advanced the preset for the control is different --> 0.0 (The server default)
        useAtl24InvalidKD: false,
        atl24InvalidKD:false,
        useAtl24InvalidWindspeed: false,
        atl24InvalidWindspeed:false,
        useAtl24LowConfidence: false,
        atl24LowConfidence:false,
        useAtl24Night: false,
        atl24Night:false,
        useAtl24SensorDepthExceeded: false,
        atl24SensorDepthExceeded:false,
        atl24AncillaryFields:[] as string[],
        atl03AncillaryFields:[] as string[],
        atl08AncillaryFields:[] as string[],
        atl03_geo_fields:[] as string[],
        atl03_corr_fields:[] as string[],
        atl03_ph_fields:[] as string[],
        atl06_fields:[] as string[],
        atl08_fields:[] as string[],
        atl13_fields:[] as string[],
        gedi_fields:[] as string[],
    }),
    actions: {
        async presetForScatterPlotOverlay(parentReqId: number) { //TBD HACK when svr params is fixed it will include rgt. so use that instead of this
            // set things the user may have changed in this routine
            const parentApi = await db.getFunc(parentReqId);
            this.setMissionValue("ICESat-2");
            this.setIceSat2API("atl03x");
            this.setEnableGranuleSelection(true);//tracks and beams
            this.setUseRgt(true);
            this.setUseCycle(true);
            const poly = await db.getSvrReqPoly(parentReqId);
            if(poly){
                this.setPoly(poly);
                this.setConvexHull(convexHull(poly));
                this.setAreaOfConvexHull(calculatePolygonArea(poly));
            } else {
                console.error('presetForScatterPlotOverlay: no poly for parentReqId:', parentReqId);
            }
            //this.setSrt([-1]);
            this.signalConfidenceNumber = [0,1,2,3,4];
            if(parentApi === 'atl24x'){
              this.enableAtl24Classification = true;
              this.enableAtl08Classification = false;
              this.atl24_class_ph = this.atl24_class_ph_Options;
              this.useDatum = true;
            } else {
              this.enableAtl24Classification = false;
              this.enableAtl08Classification = true;
              this.atl08LandType = ['atl08_noise','atl08_ground','atl08_canopy','atl08_top_of_canopy','atl08_unclassified'];
            }
            this.enableYAPC = true;
            this.YAPCVersion = 0;
            this.setUseRgt(true);
            //TBD maybe when svr params is fixed it will include rgt. so use that instead of this
            this.setSelectedTrackOptions(useGlobalChartStore().getSelectedTrackOptions());
            this.setSelectedGtOptions(useGlobalChartStore().getSelectedGtOptions());
            this.setRgt(useGlobalChartStore().getRgt());
            this.setEnableGranuleSelection(true);
            this.setUseCycle(true);
            this.setCycle(useGlobalChartStore().getCycles()[0]);
            //console.log('presetForScatterPlotOverlay: tracks:', this.getSelectedTrackOptions(),'gts:', this.getSelectedGtOptions(), 'rgts:', this.getRgt(), 'cycles:', this.getCycle());
        },
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
        getFunc(): string {
          let func = 'xxx';
          if(this.missionValue === 'ICESat-2') {
            func = this.iceSat2SelectedAPI;
          } else if (this.missionValue === 'GEDI') {
            func = this.gediSelectedAPI;
          } else {
            console.error('getFunc: mission not recognized:', this.missionValue);
          }
          return func;
        },
        getAtlReqParams(req_id: number): AtlReqParams { 
          //console.log('getAtlReqParams req_id:', req_id);
          const getOutputPath = (): string => {
            let path = this.outputLocationPath;
            if (this.outputLocation.value === 'S3') {
              path = `s3://${this.outputLocationPath}`;
            }
            if (this.outputLocationPath.length === 0) {
              //Note: This is only used by the server. It needs to be unique for each request.
              // We create a similar filename for our local client elsewhere.
              let reqIdStr = 'nnn';
              if(req_id > 0) {
                reqIdStr = `${req_id}`;
              }
              path = `${this.getFunc()}_${reqIdStr}_${new Date().toISOString()
                .replace(/:/g, '_')
                .replace(/\./g, '_')
                .replace(/T/g, '_')
                .replace(/Z/g, '')}`;
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
          }
          if(this.missionValue === 'ICESat-2') {
            if(this.iceSat2SelectedAPI === 'atl06sp') { // land ice
              this.setAsset('icesat2-atl06'); 
            } else {
              this.setAsset('icesat2');
            }
          } else if (this.missionValue === 'GEDI') {
            console.log('GEDI API:', this.gediSelectedAPI);
            if(this.gediSelectedAPI === 'gedi01bp') {
              this.setAsset('gedil1b');
            } else if(this.gediSelectedAPI === 'gedi02ap') {
              this.setAsset('gedil2a');
            } else if(this.gediSelectedAPI === 'gedi04ap') {
              this.setAsset('gedil4a');
            }
            if(this.gedi_fields.length>0) {
              req.anc_fields = this.gedi_fields;
            }

          } else {
            console.error('getAtlReqParams: mission not recognized:', this.missionValue);
          }
          if(this.iceSat2SelectedAPI==='atl08p') {
            req.phoreal = {};
          }
          if(this.iceSat2SelectedAPI === 'atl24x'){
            req.atl24 = {};
            if(this.useAtl24Compact){
              req.atl24.compact = this.atl24Compact;
            }
            if(this.useAtl24Classification){
              req.atl24.classification = this.atl24Classification;
            }
            if(this.useAtl24ConfidenceThreshold){
              req.atl24.confidence_threshold = this.atl24ConfidenceThreshold;
            }
            if(this.useAtl24InvalidKD){
              req.atl24.invalid_kd = this.atl24InvalidKD;
            }
            if(this.useAtl24InvalidWindspeed){
              req.atl24.invalid_windspeed = this.atl24InvalidWindspeed;
            }
            if(this.useAtl24LowConfidence){
              req.atl24.low_confidence = this.atl24LowConfidence;
            }
            if(this.useAtl24Night){
              req.atl24.night = this.atl24Night;
            }
            if(this.useAtl24SensorDepthExceeded){
              req.atl24.sensor_depth_exceeded = this.atl24SensorDepthExceeded;
            }
            if(this.atl24AncillaryFields.length>0){
              req.atl24.anc_fields = this.atl24AncillaryFields;
            }
          } else {
            req.asset = this.getAsset();
            if(this.missionValue === 'ICESat-2') {
              if(this.enableAtl03Confidence) {
                if (this.surfaceReferenceType.length===1 &&  this.surfaceReferenceType[0].value===-1){
                  req.srt = -1; // and not [-1]
                } else {
                  if(this.surfaceReferenceType.length>=1){
                    req.srt = this.getSrt();
                  }
                }
              }
            }
          }
          if(this.iceSat2SelectedAPI.includes('atl03')){ 
            if(this.atl03_geo_fields.length>0) {
              req.atl03_geo_fields = this.atl03_geo_fields;
            }
            if(this.atl03_corr_fields.length>0) {
              req.atl03_corr_fields = this.atl03_corr_fields;
            }
            if(this.atl03_ph_fields.length>0) {
              req.atl03_ph_fields = this.atl03_ph_fields;
            }
          }
          if(this.iceSat2SelectedAPI.includes('atl06')){ 
            if(this.atl06_fields.length>0) {
              req.atl06_fields = this.atl06_fields;
            }
          }
          if(this.iceSat2SelectedAPI.includes('atl08')){ 
            if(this.atl08_fields.length>0) {
              req.atl08_fields = this.atl08_fields;
            }
          }
          if(this.signalConfidenceNumber.length>0){
            req.cnf = this.signalConfidenceNumber;
          }

          if(this.missionValue === 'ICESat-2') {
            if(this.getEnableSurfaceElevation()){
              if(this.getSigmaRmax()>=0.0){//maxRobustDispersion
                  req.sigma_r_max = this.getSigmaRmax();
              }
              if(this.getMaxIterations()>=0){
                req.maxi = this.getMaxIterations();
              }
              if(this.getMinWindowHeight() >= 0.0){
                req.H_min_win = this.getMinWindowHeight();
              }
            }
            if(this.useLength){
              req.len = this.getLengthValue();
            }
            if(this.useStep){
              req.res = this.getStepValue();
            }
          } else if(this.missionValue === 'GEDI') {
            if(this.degradeFlag){
              req.degrade = true;
            }
            if(this.l2QualityFlag){
              req.l2_quality = true;
            }
            if(this.l4QualityFlag){
              req.l4_quality = true;
            }
            if(this.surfaceFlag){
              req.surface = true;
            }
          }
          if(this.poly && !this.ignorePolygon) {
            req.poly = this.poly;
          }
          if(this.passInvalid) {
            req.pass_invalid = true;
          } else {
            if(this.getUseAlongTrackSpread()){
              req.ats = this.alongTrackSpread;
            }
            if(this.getUseMinimumPhotonCount()){ 
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
            if(this.getUseTime()){
              if(this.getT0()){
                req.t0 = convertTimeFormat(this.getT0(),'%Y-%m-%dT%H:%M:%SZ');
              }
              if(this.getT1()){
                req.t1 = convertTimeFormat(this.getT1(),'%Y-%m-%dT%H:%M:%SZ');
              }
            }
          }
          if(this.enableAtl03Confidence) {
            if(this.qualityPHNumber.length>0){
              req.quality_ph = this.qualityPHNumber;
            }
          }

          if(this.enableAtl08Classification) {
            if(this.atl08LandType.length>0){
              req.atl08_class = this.atl08LandType;
            }
          }

          if(this.enableAtl24Classification) {
            if (!req.atl24) req.atl24 = {}; 
            if(this.atl24_class_ph.length>0){
              req.atl24.class_ph = this.atl24_class_ph;
            }
          }

          if(this.enableYAPC) {
            // const yapc:YapcConfig = {
            //   version: Number(this.getYAPCVersion()),
            //   score: this.getYAPCScore(),
            // };
            let yapc = {} as Icesat2ConfigYapc;
            yapc.version = this.getYAPCVersion();
            yapc.score = this.YAPCScore;
            if(this.usesYAPCKnn) {
              yapc.knn = this.YAPCKnn
            }
            if(this.usesYAPCWindowHeight) {
              yapc.win_h = this.YAPCWindowHeight
            }
            if(this.usesYAPCWindowWidth) {
              yapc.win_x = this.YAPCWindowWidth
            }
            req.yapc = yapc;
            //console.log('using req.yapc:',req.yapc)
          }
          if (this.poly && this.convexHull) {
            req.cmr = { polygon: this.convexHull };
          }
          if(useMapStore().getPolySource()=='Upload geojson File' && this.poly) {
            // req.raster = {
            //   data: this.poly,
            //   length: this.poly.length,
            //   cellsize: this.getRasterizePolyCellSize(),
            // }
            console.log("TBD set raster here?");
          }
          if(this.distanceIn.value === 'segments') {
            req.dist_in_seg = true;
          }
          if(this.useServerTimeout) {
            req.timeout = this.serverTimeoutValue;
          } 
          if(this.useReqTimeout) {
            req['rqst-timeout'] = this.reqTimeoutValue;
          }
          if(this.useNodeTimeout) {
            req['node-timeout'] = this.nodeTimeoutValue;
          }
          if(this.useReadTimeout) {
            req['read-timeout'] = this.readTimeoutValue;
          }
          if(this.useDatum) {
            req.datum = 'EGM08';
          }
          //console.log('getAtlReqParams req_id:', req_id, 'req:', req);
          return req;
        },        
        getSrt(): number[] {
          return this.surfaceReferenceType.map(item => item.value);
        },
        getSurfaceReferenceType(name: string): number {
          const option = this.surfaceReferenceTypeOptions.find(option => option.name === name);
          return option ? option.value : -1;
        },
        getWorkerThreadTimeout(): number {
          let timeout = 600000; // 10 minutes
          if(this.getReqTimeout()>0){
            timeout = (this.getReqTimeout()*1000) + 5000; //millisecs; add 5 seconds to the request timeout to allow server to timeout first; 
          } else {
            timeout = 600*1000+5000; // default to 10 minutes 5 seconds. TBD use server defaults api to set this
          } 
          if(this.useNodeTimeout && this.getNodeTimeout()>0){
            const nodeTimeSetting = this.getNodeTimeout()*1000 + 5000;
            if(nodeTimeSetting > timeout){
              timeout = nodeTimeSetting;
            }
          }
          if(this.useReadTimeout && this.getReadTimeout()>0){
            const readTimeSetting = this.getReadTimeout()*1000 + 5000;
            if(readTimeSetting > timeout){
              timeout = readTimeSetting;
            }
          }
          console.log('getWorkerThreadTimeout this.getReqTimeout:', this.getReqTimeout(), 'timeout:', timeout); 
          return timeout;      
        },
        getAtlxxReqParams(req_id: number): AtlxxReqParams {
          const baseParams:AtlxxReqParams = {
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
        getUseTime(): boolean {
          return this.useTime;
        },
        setUseTime(useTime:boolean) {
          this.useTime = useTime;
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
        getGpsToUTCOffset(): number { // hack a constant instead of a function of time
          return this.gpsToUTCOffset;
        },
        setGpsToUTCOffset(gpsToUTCOffset:number) {
          this.gpsToUTCOffset = gpsToUTCOffset;
        },
        setSelectedGtOptions(gts: SrListNumberItem[]) {
          this.beams = gts; // in the req it is called beams
        },
        getSelectedGtOptions(): SrListNumberItem[] {
          return this.beams; // in the req it is called beams
        },
        setSelectedTrackOptions(tracks: SrListNumberItem[]) {
          this.tracks = tracks;
        },
        getSelectedTrackOptions() {
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
        getMinWindowHeight():number {
          return this.minWindowHeight;
        },
        setMinWindowHeight(minWindowHeight:number) {
          this.minWindowHeight = minWindowHeight;
        },
        setUseLength(useLength:boolean){
          this.useLength = useLength;
        },
        getUseLength(){
          return this.useLength;
        },
        getLengthValue(): number {
          return this.lengthValue;
        },
        setLengthValue(lengthValue:number) {
          this.lengthValue = lengthValue;
        },
        setUseStep(useStep:boolean){
          this.useStep = useStep;
        },
        getUseStep(){
          return this.useStep;
        },
        getStepValue(): number {
          return this.stepValue;
        },
        setStepValue(stepValue:number) {
          this.stepValue = stepValue;
        },
        getSigmaRmax(): number {
          return this.maxRobustDispersion;
        },
        setSigmaRmax(sigma_r_max:number) {
          this.maxRobustDispersion= sigma_r_max;
        },
        getMaxIterations():number {
          return this.maxIterations;
        },
        setMaxIterations(maxIterations:number) {
          this.maxIterations = maxIterations;
        },
        getUseAlongTrackSpread(): boolean{
          return this.useAlongTrackSpread;
        },
        setUseAlongTrackSpread(ats:boolean){
          this.useAlongTrackSpread;
        },
        getAlongTrackSpread():number {
          return this.alongTrackSpread;
        },
        setAlongTrackSpread(alongTrackSpread:number) {
          this.alongTrackSpread = alongTrackSpread;
        },
        getUseMinimumPhotonCount(): boolean{
          return this.useMinimumPhotonCount;
        },
        setUseMinimumPhotonCount(useMinimumPhotonCount:boolean){
          this.useMinimumPhotonCount = useMinimumPhotonCount;
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
        async restoreTimeouts() {
          this.useServerTimeout = false;
          this.useReqTimeout = false;
          this.useNodeTimeout = false;
          this.useReadTimeout = false;
          const sto = await useSlideruleDefaults().getNestedMissionDefault<number>(this.missionValue, 'timeout');
          if(sto){
              this.setServerTimeout(sto);
          } else {
              console.warn('No default server timeout found, setting to fallback default of 601 seconds');
              this.setServerTimeout(601); // fallback default
          }
          const nto = await useSlideruleDefaults().getNestedMissionDefault<number>(this.missionValue, 'node_timeout');
          if(nto){
              this.setNodeTimeout(nto);
          } else {
              console.warn('No default node timeout found, setting to fallback default of 601 seconds');
              this.setNodeTimeout(601); // fallback default
          }
          const rto = await useSlideruleDefaults().getNestedMissionDefault<number>(this.missionValue, 'read_timeout');
          if(rto){
              this.setReadTimeout(rto);
          } else {
              console.warn('No default read timeout found, setting to fallback default of 601 seconds');
              this.setReadTimeout(601); // fallback default
          }
          const rqto = await useSlideruleDefaults().getNestedMissionDefault<number>(this.missionValue, 'rqst_timeout');
          if(rqto){
              this.setReqTimeout(rqto);
          } else {
              console.warn('No default request timeout found, setting to fallback default of 601 seconds');
              this.setReqTimeout(601); // fallback default
          }
        },
        getUseServerTimeout(): boolean {
          return this.useServerTimeout;
        },
        setUseServerTimeout(useServerTimeout:boolean) {
          this.useServerTimeout = useServerTimeout;
        },
        getServerTimeout(): number {
          return this.serverTimeoutValue; 
        },
        setServerTimeout(serverTimeoutValue:number) {
          this.serverTimeoutValue = serverTimeoutValue;
        },
        getYAPCScore():number {
          return this.YAPCScore;
        },
        setYAPCScore(value:number) {
          //console.trace('setYAPCScore')
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
        getYAPCVersion():number {
          return this.YAPCVersion;
        },
        setYAPCVersion(value:number) {
          this.YAPCVersion = value;
        },

        async initYapcDefaults(){
          const yapc = await useSlideruleDefaults().getNestedMissionDefault<object>(this.missionValue,'yapc') as Icesat2ConfigYapc;
          console.log('yapc:',yapc);
          if (yapc) {
            this.setYAPCVersion(yapc['version']); //3
            console.log('yapc[score]:',yapc['score']);
            this.setYAPCScore(yapc['score']); //0
            this.setYAPCKnn(yapc['knn']); //0
            this.setYAPCWindowHeight(yapc['win_h']); //10
            this.setYAPCWindowWidth(yapc['win_x']); //10
          }
                  
        },
        getMissionValue() : string {
          return this.missionValue;
        },
        setMissionValue(value:string) {
          if (value === 'ICESat-2') {
              this.iceSat2SelectedAPI = this.iceSat2APIsItems[0]; // Reset to default when mission changes
          } else if (value === 'GEDI') {
              this.gediSelectedAPI = this.gediAPIsItems[0]; // Reset to default when mission changes
          }
          this.missionValue = value;
        },
        getMissionItems(): string[] {
          return this.missionItems;
        },
        getIceSat2API() : string {
          //console.log('getIceSat2API:', this.iceSat2SelectedAPI);
          return this.iceSat2SelectedAPI;
        },
        setIceSat2API(value:string) {
          //console.log('setIceSat2API:', value);
          this.iceSat2SelectedAPI = value;
        },
        getGediAPI() : string {
          return this.gediSelectedAPI;
        },
        setGediAPI(value:string) {
          this.gediSelectedAPI = value;
        },
        getCurAPIStr() : string {
          if(this.missionValue === 'ICESat-2') {
            return this.iceSat2SelectedAPI;
          } else if(this.missionValue === 'GEDI') {
            return this.gediSelectedAPI;
          }
          return '';
        },
        getCurAPIObj(): ApiName | null {
          if (this.missionValue === 'ICESat-2' && isValidAPI(this.iceSat2SelectedAPI)) {
            return this.iceSat2SelectedAPI as ApiName;
          } else if (this.missionValue === 'GEDI' && isValidAPI(this.gediSelectedAPI)) {
            return this.gediSelectedAPI as ApiName;
          }
          console.error('getCurAPIObj: mission not recognized or API not valid mission:', this.missionValue,'iceSat2API:', this.iceSat2SelectedAPI, 'gediAPI:', this.gediSelectedAPI);
          return null; // Explicitly return `null` instead of `''`
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
        getEnableAtl08Classification(): boolean {
          return this.enableAtl08Classification;
        },
        setEnableAtl08Classification(enableAtl08Classification:boolean) {
          this.enableAtl08Classification = enableAtl08Classification;
        },
        getEnableSurfaceElevation(): boolean {
          return this.enableSurfaceElevation;
        },
        setEnableSurfaceElevation(enableSurfaceElevation:boolean) {
          this.enableSurfaceElevation = enableSurfaceElevation;
        },
        setPoly(poly: SrRegion) {
          this.poly = poly;
        },
        setCmr(cmr: { polygon: SrRegion }) {
          this.poly = cmr.polygon;
        },
    },
})
const theReqParamsStore = createReqParamsStore('reqParamsStore');
const theAutoReqParamsStore = createReqParamsStore('autoReqParamsStore');
export const useReqParamsStore = theReqParamsStore;
export const useAutoReqParamsStore = theAutoReqParamsStore;

