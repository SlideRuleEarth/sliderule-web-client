import { defineStore } from 'pinia'
import type { SrMultiSelectTextItem } from '@/components/SrMultiSelectText.vue';
import type { SrMultiSelectNumberItem } from '@/components/SrMultiSelectNumber.vue';
import type { SrMenuMultiCheckInputOption } from '@/components/SrMenuMultiCheckInput.vue';
import type { Atl06ReqParams, Atl06pReqParams, SrRegion } from '@/sliderule/icesat2';

export interface NullReqParams {
  null: null;
}

export type ReqParams = Atl06ReqParams | Atl06pReqParams | NullReqParams;

export const useReqParamsStore = defineStore('reqParams', {

    state: () => ({
        missionValue: {name: 'ICESat-2', value: 'ICESat-2'},
        missionItems:[{name:'ICESat-2',value:'ICESat-2'},{name:'GEDI',value:'GEDI'}],
        iceSat2SelectedAPI: {name: 'atl06', value: 'atl06'},
        iceSat2APIsItems: [{name:'atl06',value:'atl06'},{name:'atl03',value:'atl03'},{name:'atl08',value:'atl08'},{name:'atl24',value:'atl24'}],
        gediSelectedAPI: {name:'gedi01b',value:'gedi01b'},
        gediAPIsItems: [{name:'gedi01b',value:'gedi01b'},{name:'gedi02a',value:'gedi02a'},{name:'gedi04a',value:'gedi04a'}],
        using_worker: false,
        asset: 'icesat2',
        isArrowStream: false,
        isFeatherStream: false,
        rasterizePolygon: false,
        ignorePolygon: false,
        poly: null as SrRegion | null,
        convexHull: null as SrRegion | null,
        urlValue: 'slideruleearth.io',
        enableGranuleSelection: false,
        tracks:  ['Track 1', 'Track 2', 'Track 3'],
        tracksOptions: ['1', '2', '3'],
        selectAllTracks: false,
        beams: ['gt1l', 'gt1r', 'gt2l', 'gt2r', 'gt3l', 'gt3r'],
        beamsOptions: ['gt1l', 'gt1r', 'gt2l', 'gt2r', 'gt3l', 'gt3r'], 
        selectAllBeams: false,
        rgtValue: 1,
        cycleValue: 1,
        regionValue: 1,
        t0Value: '2020-01-01',
        t1Value: '2020-01-01',
        totalTimeoutValue: 600,
        reqTimeoutValue: 600,
        nodeTimeoutValue: 1,
        readTimeoutValue: 1,
        lengthValue: 40.0,
        stepValue: 20.0,
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
        signalConfidence: [ 
          'atl03_background' ,
          'atl03_within_10m' ,
          'atl03_low' ,
          'atl03_medium' ,
          'atl03_high' ,
        ],

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
        signalConfidenceNumber: [ 4 ],

        qualityPHValue: 0.0,
        enableAtl08Confidence: false,
        atl08LandTypeOptions: [
          {name:'Noise', value:'atl08_noise'}, 
          {name: 'Ground', value: 'atl08_ground'},
          {name:'Canopy', value:'atl08_canopy'},
          {name:'Top of Canopy', value:'atl08_top_of_canopy'},
          {name:'Unclassified', value:'atl08_unclassified'},
          ] as SrMultiSelectTextItem[], 
        landType: [] as SrMultiSelectTextItem[],
        distanceInOptions:[
          { name: 'meters', value: 'meters' },
          { name: 'segments', value: 'segments' },
        ] as SrMultiSelectTextItem[],
        distanceIn: { name: 'meters', value: 'meters' },
        passInvalid: false,
        alongTrackSpread: 20.0,
        minimumPhotonCount: 10,
        maxIterations: 6,
        minWindowHeight: 3.0,
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
        gediBeams: [
          {name:'0',value:'0'}, 
          {name:'1',value:'1'},
          {name:'2',value:'2'},
          {name:'3',value:'3'},
          {name:'5',value:'5'},
          {name:'6',value:'6'},
          {name:'8',value:'8'},
          {name:'11',value:'11'},
        ],
        gediBeamsOptions: [
          {name:'0',value:'0'}, 
          {name:'1',value:'1'},
          {name:'2',value:'2'},
          {name:'3',value:'3'},
          {name:'5',value:'5'},
          {name:'6',value:'6'},
          {name:'8',value:'8'},
          {name:'11',value:'11'},
        ],
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
        YAPC: false,
        YAPCScore: 0.0,
        usesYAPCKnn: false,
        YAPCKnn: 0,
        usesYAPCWindowHeight: false,
        YAPCWindowHeight: 0.0,
        usesYAPCWindowWidth: false,
        YAPCWindowWidth: 0.0,
        usesYAPCVersion: false,
        YAPCVersion: {name:"version1", value:"version1"},
        YAPCVersionOptions: [
          {name:"version1", value:"version1"},
          {name:"version2", value:"version2"},
          {name:"version3", value:"version3"},
        ],

        resources: [] as string[],
        target_numAtl06Recs: 0,
        target_numAtl06pRecs: 0,
    }),
    actions: {
        setRasterizePolygon(value:boolean) {
          this.rasterizePolygon = value;
        },
        addResource(resource: string) {
          if (resource.trim().length) {
            this.resources.push(resource);
          }
        },
        removeResource(index: number) {
          this.resources.splice(index, 1);
        },
        getAtl06ReqParams(req_id:number): Atl06ReqParams { 
          const req: Atl06ReqParams = {
            asset: this.asset,
            srt: this.getSrt(),
            cnf: this.signalConfidenceNumber,
            atl08_class: [], // HACK: This is a placeholder
            ats: this.alongTrackSpread,  
            cnt: this.minimumPhotonCount, 
            len: this.lengthValue,        
            res: this.stepValue, 
            sigma_r_max: this.sigmaValue,         
            maxi: this.maxIterations,
            poly: this.poly,
          };         
          if(this.poly && this.convexHull)
          {
            req.cmr = {polygon: this.convexHull};
          }
          if (this.fileOutput===true) {
            let path_to_use = this.outputLocationPath;
            if(this.outputLocation.value==='S3'){
              path_to_use = `s3://${this.outputLocationPath}`;
            }
            if(this.outputLocationPath.length===0){
              path_to_use = `atl06_${req_id}_${new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-').replace(/T/g, '-').replace(/Z/g, '')}`;
            }
            if(this.outputFormat.value==='geoparquet' || this.outputFormat.value==='parquet'){
              path_to_use += '.parquet';
              if(this.outputFormat.value==='geoparquet'){
                req.output = {format: 'parquet', as_geo: true, path: path_to_use};
              } else {
                req.output = {format: 'parquet', as_geo: false, path: path_to_use};
              }
              this.isArrowStream = true;
            } else {
              console.error('getAtl06ReqParams: outputFormat not recognized:', this.outputFormat.value);
            }
          }
          if(this.enableGranuleSelection===true){
            if(this.tracks.length>0){
              req.tracks = this.tracks;
            }
            if(this.beams.length>0){
              req.beams = this.beams;
            }
          }
          return req;
        },
        getSrt(): number[] | number {
          if (this.surfaceReferenceType.length===1 &&  this.surfaceReferenceType[0]===-1){
            return -1;
          } else {
            return this.surfaceReferenceType;
          }        
        },
        getAtl06pReqParams(req_id:number): Atl06pReqParams {
          if(this.resources.length > 0){
            return  {
              parms:this.getAtl06ReqParams(req_id),
              resources: this.resources,     
            };
          } else {
            console.log('getAtl06pReqParams: resources is empty');
            return {
              parms:this.getAtl06ReqParams(req_id),
            };
          }
        },
        setReqion(reqionValue:number) {
          this.regionValue = reqionValue;
        },
        setRgt(rgtValue:number) {
          this.rgtValue = rgtValue;
        },
        setCycle(cycleValue:number) {
          this.cycleValue = cycleValue;
        },
        setBeams(beams:string[]) {
          this.beams = beams;
        },
        setTracks(tracks:string[]) {
          this.tracks = tracks;
        },
        setSelectAllTracks(selectAllTracks:boolean) {
          this.selectAllTracks = selectAllTracks;
        },
        setSelectAllBeams(selectAllBeams:boolean) {
          this.selectAllBeams = selectAllBeams;
        },

    },
})


