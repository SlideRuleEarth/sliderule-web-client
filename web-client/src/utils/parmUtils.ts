import { type SrListNumberItem } from '@/stores/atlChartFilterStore';
export interface SrScatterOptionsParms {
  rgts: number[];
  cycles: number[];
  fileName: string;
  func: string;
  y: string[];
  x: string;
  beams?: number[];
  spots?: number[];
  pairs?: number[];
  scOrients?: number[];
  tracks?: number[];
};

export const tracksOptions = [
    { label: '1' , value: 1 }, 
    { label: '2' , value: 2 },
    { label: '3' , value: 3 }
  ] as SrListNumberItem[];

export const beamsOptions = [
    {label:'gt1l',value:10}, 
    {label:'gt1r',value:20}, 
    {label:'gt2l',value:30}, 
    {label:'gt2r',value:40}, 
    {label:'gt3l',value:50}, 
    {label:'gt3r',value:60}
  ] as SrListNumberItem[];

export const spotsOptions = [
    {label:'1',value:1}, 
    {label:'2',value:2}, 
    {label:'3',value:3}, 
    {label:'4',value:4}, 
    {label:'5',value:5}, 
    {label:'6',value:6}
  ] as SrListNumberItem[];

  export function getBeamsAndTracksWithGts(gts:SrListNumberItem[]) {
    const beams = [] as SrListNumberItem[];
    for (const beam of beamsOptions) {
      for(const gt of gts){
        if (beam.value === gt.value) {
          beams.push(beam);
          break;
        }
      }
    }

    const tracks = [] as SrListNumberItem[];
    //console.log('tracksOptions:',tracksOptions,' beams:',beams);
    for(const track of tracksOptions){
      for (const beam of beams) {
        if(Number(beam.label.charAt(2)) === track.value){
            tracks.push(track);
            break;
        }
      }
    }
    //console.log('getBeamsAndTracksWithGts gts:',gts);
    //console.log('getBeamsAndTracksWithGts beams:',beams);
    //console.log('getBeamsAndTracksWithGts tracks:',tracks);
    return {beams, tracks};
  }

  export function findParam(obj: any, key: string): any | undefined {
    // Check if the current object is null or not an object
    if (obj === null || typeof obj !== 'object') {
        return undefined;
    }

    // Check if the key exists in the current object using Object.prototype.hasOwnProperty.call
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return obj[key];
    }

    // Recurse through each property in the object
    for (const prop in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            // Recursively call findParam on the property
            const result = findParam(obj[prop], key);
            // If the parameter is found in a nested object, return the result
            if (result !== undefined) {
                return result;
            }
        }
    }

    // Return undefined if the parameter is not found
    return undefined;
}
export function getScOrientFromSpotGt(spot:number,gt:number) {
  let scOrient = -1; // 0 = forward 1 = backward
  if (spot === 1 ) {
    if(gt === 60){
      scOrient = 0;
    } else if (gt === 10){
      scOrient = 1;
    } else {
      console.log('getScOrientFromSpotGt: INVALID combo? spot:', spot, 'gt:', gt);
    }
  } else if (spot === 2) {
    if(gt === 50){
      scOrient = 0;
    } else if (gt === 20){
      scOrient = 1;
    } else {
      console.log('getScOrientFromSpotGt: INVALID combo? spot:', spot, 'gt:', gt);
    }
  } else if (spot === 3) {
    if(gt === 40){
      scOrient = 1;
    } else if (gt === 30){
      scOrient = 0;
    } else {
      console.log('getScOrientFromSpotGt: INVALID combo? spot:', spot, 'gt:', gt);
    }
  } else if (spot === 4) {
    if(gt === 30){
      scOrient = 0;
    } else if (gt === 40){
      scOrient = 1;
    } else {
      console.log('getScOrientFromSpotGt: INVALID combo? spot:', spot, 'gt:', gt);
    }
  } else if (spot === 5) {
    if(gt === 20){
      scOrient = 0;
    } else if (gt === 50){
      scOrient = 1;
    } else {
      console.log('getScOrientFromSpotGt: INVALID combo? spot:', spot, 'gt:', gt);
    }
  } else if (spot === 6) {
    if(gt === 10){
      scOrient = 0;
    } else if (gt === 60){
      scOrient = 1;
    } else {
      console.log('getScOrientFromSpotGt: INVALID combo? spot:', spot, 'gt:', gt);
    }
  }
  //console.log('getScOrientFromSpotGt: spot:', spot, 'gt:', gt, 'scOrient:', scOrient);
  return scOrient;
}

export function convertTimeFormat(timeObj: Date, fmt: string): string {
  const padZero = (num: number): string => num < 10 ? `0${num}` : String(num);

  const replacements: Record<string, string> = {
      '%Y': String(timeObj.getUTCFullYear()),              // Full year (e.g., 2024)
      '%m': padZero(timeObj.getUTCMonth() + 1),            // Month (01-12)
      '%d': padZero(timeObj.getUTCDate()),                 // Day of the month (01-31)
      '%H': padZero(timeObj.getUTCHours()),                // Hours (00-23)
      '%M': padZero(timeObj.getUTCMinutes()),              // Minutes (00-59)
      '%S': padZero(timeObj.getUTCSeconds()),              // Seconds (00-59)
      'Z': 'Z'                                             // Append 'Z' for UTC time
  };

  // Replace the placeholders in the format string with actual values
  return fmt.replace(/%[YmdHMS]|Z/g, match => replacements[match]);
}
