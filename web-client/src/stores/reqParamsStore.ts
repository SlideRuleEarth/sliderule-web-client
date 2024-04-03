import { defineStore } from 'pinia'
import type { SrMultiSelectItem } from '@/components/SrMultiSelect.vue';
import type { SrMenuMultiCheckInputOption } from '@/components/SrMenuMultiCheckInput.vue';
import type { Atl06ReqParams, Atl06pReqParams } from '@/sliderule/icesat2';
export type ReqParams = Atl06ReqParams | Atl06pReqParams;


export const useReqParamsStore = defineStore('reqParams', {

    state: () => ({
        rasterizePolygon: false,
        ignorePolygon: false,
        missionValue: {name:'mission', value:'-2'},
        urlValue: 'slideruleearth.io',
        tracks:  ['Track 1', 'Track 2', 'Track 3'],
        tracksOptions: ['Track 1', 'Track 2', 'Track 3'],
        beams: ['gt1l', 'gt1r', 'gt2l', 'gt2r', 'gt3l', 'gt3r'],
        beamsOptions: ['gt1l', 'gt1r', 'gt2l', 'gt2r', 'gt3l', 'gt3r'], 
        rgtValue: 1,
        cycleValue: 1,
        regionValue: 1,
        t0Value: '2020-01-01',
        t1Value: '2020-01-01',
        totalTimeoutValue: 60,
        reqTimeoutValue: 1,
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
          { name: 'Land', value:'L' },
          { name: 'Ocean', value:'O' },
          { name: 'Sea Ice', value:'S'},
          { name: 'Land Ice', value:'I'},
          { name: 'Inland Water',value:'W' },
        ] as SrMultiSelectItem[],
        surfaceReferenceType:[] as string[],
        signalConfidenceOptions: 
        [
          { name: 'TEP', value: 'atl03_tep' },
          { name: 'Not Considered', value: 'atl03_not_considered' },
          { name: 'Background', value: 'atl03_background' },
          { name: 'Within 10m', value: 'atl03_within_10m' },
          { name: 'Low', value: 'atl03_low' },
          { name: 'Medium', value: 'atl03_medium' },
          { name: 'High', value: 'atl03_high' },
        ] as SrMultiSelectItem[],
        signalConfidence: [ 
          'atl03_background' ,
          'atl03_within_10m' ,
          'atl03_low' ,
          'atl03_medium' ,
          'atl03_high' ,
        ],
        qualityPHValue: 0.0,
        enableAtl08Confidence: false,
        atl08LandTypeOptions: [
          {name:'Noise', value:'atl08_noise'}, 
          {name: 'Ground', value: 'atl08_ground'},
          {name:'Canopy', value:'atl08_canopy'},
          {name:'Top of Canopy', value:'atl08_top_of_canopy'},
          {name:'Unclassified', value:'atl08_unclassified'},
          ] as SrMultiSelectItem[], 
        landType: [] as SrMultiSelectItem[],
        distanceInOptions:[
          { name: 'meters', value: 'meters' },
          { name: 'segments', value: 'segments' },
        ] as SrMultiSelectItem[],
        distanceIn: { name: 'meters', value: 'meters' },
        passInvalid: false,
        alongTrackSpread: 20.0,
        minimumPhotonCount: 10,
        maxIterations: 0,
        minWindowHeight: 0.0,
        maxRobustDispersion: 0.0,
        binSize: 0.0,
        geoLocation: {name: "mean", value: "mean"},
        geoLocationOptions: [
          { name: 'mean', value: 'mean' },
          { name: 'median', value: 'median' },
          { name: 'center', value: 'center' },
        ] as SrMultiSelectItem[],
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
        saveOutput: false,
        staged: false,
        outputFormat: {name:"geoparquet", value:"geoparquet"},
        outputFormatOptions: [
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
        getAtl06ReqParams(): Atl06ReqParams {
          return {
            cnf: this.signalConfidence,   
            ats: this.alongTrackSpread,  
            cnt: this.minimumPhotonCount, 
            len: this.lengthValue,        
            res: this.stepValue,          
            maxi: this.maxIterations      
          };
        },
        getAtl06pReqParams(): Atl06pReqParams {
          return {
            atl06Params: this.getAtl06ReqParams(),
            resources: this.resources
          };
        },
    },
})


