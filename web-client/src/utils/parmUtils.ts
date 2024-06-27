import { type SrMultiSelectNumberItem } from '@/components/SrMultiSelectNumber.vue';

export const tracksOptions = [
    { name: 'Track 1' , value: 1 }, 
    { name: 'Track 2' , value: 2 },
    { name: 'Track 3' , value: 3 }
  ] as SrMultiSelectNumberItem[];

export const beamsOptions = [
    {name:'gt1l',value:10}, 
    {name:'gt1r',value:20}, 
    {name:'gt2l',value:30}, 
    {name:'gt2r',value:40}, 
    {name:'gt3l',value:50}, 
    {name:'gt3r',value:60}
  ] as SrMultiSelectNumberItem[];

  export function getBeamsAndTracksWithGt(gt:number) {
    const beams = [] as number[];
    let beam_name='';
    for (const beam of beamsOptions) {
      if (beam.value === gt) {
        beams.push(beam.value);
        beam_name = beam.name;
        break;
      }
    }
    const tracks = [] as number[];
    for(const track of tracksOptions){
        if(Number(beam_name.charAt(2)) === track.value){
            tracks.push(track.value);
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
