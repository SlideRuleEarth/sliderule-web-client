export const tracksOptions = [
    { name: 'Track 1' , value: 1 }, 
    { name: 'Track 2' , value: 2 },
    { name: 'Track 3' , value: 3 }
  ] as SrMultiSelectTextItem[];

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
    
    console.log(`getBeamsAndTracksWithGt(${gt}) -> beams:`,beams,'tracks:',tracks);
    return {beams, tracks};
  }