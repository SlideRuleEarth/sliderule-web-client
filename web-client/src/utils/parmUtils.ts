import { type SrListNumberItem } from '@/stores/atlChartFilterStore';
export interface SrScatterOptionsParms {
  rgt: number;
  cycle: number;
  fileName: string;
  func: string;
  y: string[];
  x: string;
  beams?: number[];
  pair?: number;
  scOrient?: number;
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
    {label:'Spot 1 (Strong)',value:1}, 
    {label:'Spot 2 (Weak)  ',value:2}, 
    {label:'Spot 3 (Strong)',value:3}, 
    {label:'Spot 4 (Weak)  ',value:4}, 
    {label:'Spot 5 (Strong)',value:5}, 
    {label:'Spot 6 (Weak)  ',value:6}
  ] as SrListNumberItem[];

  export function getBeamsAndTracksWithGt(gt:number) {
    const beams = [] as SrListNumberItem[];
    let beam_name='';
    for (const beam of beamsOptions) {
      if (beam.value === gt) {
        beams.push(beam);
        beam_name = beam.label;
        break;
      }
    }
    const tracks = [] as SrListNumberItem[];
    for(const track of tracksOptions){
        if(Number(beam_name.charAt(2)) === track.value){
            tracks.push(track);
            break;
        }
    }
    
    //console.log(`getBeamsAndTracksWithGt(${gt}) -> beams:`,beams,'tracks:',tracks);
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
      console.error('getScOrientFromSpotBeam: INVALID combo? spot:', spot, 'gt:', gt);
    }
  } else if (spot === 2) {
    if(gt === 50){
      scOrient = 0;
    } else if (gt === 20){
      scOrient = 1;
    } else {
      console.error('getScOrientFromSpotBeam: INVALID combo? spot:', spot, 'gt:', gt);
    }
  } else if (spot === 3) {
    if(gt === 40){
      scOrient = 1;
    } else if (gt === 30){
      scOrient = 0;
    } else {
      console.error('getScOrientFromSpotBeam: INVALID combo? spot:', spot, 'gt:', gt);
    }
  } else if (spot === 4) {
    if(gt === 30){
      scOrient = 0;
    } else if (gt === 40){
      scOrient = 1;
    } else {
      console.error('getScOrientFromSpotBeam: INVALID combo? spot:', spot, 'gt:', gt);
    }
  } else if (spot === 5) {
    if(gt === 20){
      scOrient = 0;
    } else if (gt === 50){
      scOrient = 1;
    } else {
      console.error('getScOrientFromSpotBeam: INVALID combo? spot:', spot, 'gt:', gt);
    }
  } else if (spot === 6) {
    if(gt === 10){
      scOrient = 0;
    } else if (gt === 60){
      scOrient = 1;
    } else {
      console.error('getScOrientFromSpotBeam: INVALID combo? spot:', spot, 'gt:', gt);
    }
  }
  console.log('getScOrientFromSpotBeam: spot:', spot, 'gt:', gt, 'scOrient:', scOrient);
  return scOrient;
}