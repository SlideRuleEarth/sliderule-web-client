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
} from '@/types/SrTypes';

export const missionItems=['ICESat-2','GEDI'];
export const iceSat2APIsItems =  ['atl06p','atl06sp','atl03x','atl03vp','atl08p','atl24x','atl13x'];
export const gediAPIsItems = ['gedi01bp','gedi02ap','gedi04ap'];
export const surfaceReferenceTypeOptions = [
          { name: 'Dynamic', value: -1 },
          { name: 'Land', value: 0 },
          { name: 'Ocean', value: 1 },
          { name: 'Sea Ice', value: 2 },
          { name: 'Land Ice', value: 3 },
          { name: 'Inland Water', value: 4 },
    ] as SrMultiSelectNumberItem[];
export const signalConfidenceNumberOptions = [
          { name: 'Possible TEP', value: -2 },
          { name: 'Not Considered', value: -1 },
          { name: 'Background', value: 0 },
          { name: 'Within 10m', value: 1 },
          { name: 'Low', value: 2 },
          { name: 'Medium', value: 3 },
          { name: 'High', value: 4 },
    ] as SrMultiSelectNumberItem[];
export const qualityPHOptions = [
            { name: 'Nominal', value: 0 },
            { name: 'Possible Afterpulse', value: 1 },
            { name: 'Possible Impulse Response Effect', value: 2 },
            { name: 'Possible TEP', value: 3 },
    ] as SrMultiSelectNumberItem[];
export const atl08LandTypeOptions = [
          { name: 'Noise', value: 'atl08_noise' },
          { name: 'Ground', value: 'atl08_ground' },
          { name: 'Canopy', value: 'atl08_canopy' },
          { name: 'Top of Canopy', value: 'atl08_top_of_canopy' },
          { name: 'Unclassified', value: 'atl08_unclassified' },
      ] as SrMultiSelectTextItem[];
export const distanceInOptions = [
        { name: 'meters', value: 'meters' },
        { name: 'segments', value: 'segments' },
    ] as SrMenuItem[];
export const geoLocationOptions = ['mean', 'median', 'center'] as string[];
export const gediBeamsOptions = [
          { name: '0', value: 0 },
          { name: '1', value: 1 },
          { name: '2', value: 2 },
          { name: '3', value: 3 },
          { name: '5', value: 5 },
          { name: '6', value: 6 },
          { name: '8', value: 8 },
          { name: '11', value: 11 },
    ] as SrMultiSelectNumberItem[];
export const awsRegionOptions = [
          { label: 'us-west-2', value: 'us-west-2' },
          { label: 'us-west-1', value: 'us-west-1' },
          { label: 'us-east-2', value: 'us-east-2' },
          { label: 'us-east-1', value: 'us-east-1' },
          { label: 'eu-west-1', value: 'eu-west-1' },
          { label: 'eu-west-2', value: 'eu-west-2' },
          { label: 'eu-central-1', value: 'eu-central-1' },
          { label: 'ap-southeast-1', value: 'ap-southeast-1' },
          { label: 'ap-southeast-2', value: 'ap-southeast-2' },
          { label: 'ap-northeast-1', value: 'ap-northeast-1' },
          { label: 'ap-northeast-2', value: 'ap-northeast-2' },
          { label: 'ap-south-1', value: 'ap-south-1' },
          { label: 'sa-east-1', value: 'sa-east-1' },
      ] as SrListStringItem[];
export const atl24ClassOptions= [
          { name: 'bathymetry', value: 40 },
          { name: 'sea_surface', value: 41 },
          { name: 'unclassified', value: 0 },
      ] as SrMultiSelectNumberItem[];
export const YAPCVersionOptions = ['0', '1', '2', '3'] as string[];
export const atl24_class_ph_Options = ['unclassified', 'bathymetry', 'sea_surface'] as string[];
export const OnOffOptions = ['On', 'Off'] as string[];
