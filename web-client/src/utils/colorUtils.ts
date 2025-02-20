import { useColorMapStore } from '@/stores/colorMapStore';
import { computed,ref } from 'vue';


export const srColorMapNames = [
    'viridis','jet', 'hsv','hot','cool','spring','summer','autumn','winter','bone',
    'copper','greys','YIGnBu','greens','YIOrRd','bluered','RdBu','picnic',
    'rainbow','portland','blackbody','earth','electric',
    'inferno', 'magma', 'plasma', 'warm', 'cool', 'rainbow-soft',
    'bathymetry', 'cdom', 'chlorophyll', 'density', 'freesurface-blue',
    'freesurface-red', 'oxygen', 'par', 'phase', 'salinity', 'temperature', 
    'turbidity', 'velocity-blue', 'velocity-green','cubehelix'
];

export function getColorMapOptions() {
    // Get the list of valid colormap names

    // Map the colormap names to an array of { label, value } objects
    const options = srColorMapNames.map(name => {
        return {
            name: name,
            value: name
        };
    });

    return options;
}

export interface SrRGBColor {
    r: number;
    g: number;
    b: number;
}

// export const getColorForAtl03CnfValue = (value:number) => { // value is the atl03_cnf value -2 to 4
//     const ndx = value + 2;
//     if(ndx < 0 || ndx > 6){
//         return 'White'; // Return White for invalid values
//     }
//     const c = useColorMapStore().atl03CnfColorMap[ndx];
//     return c;
// };

// export const getColorForAtl08ClassValue = (value:number) => { // value is the atl08_class value 0 to 4
//     const ndx = value;
//     if(ndx < 0 || ndx > 4){
//         console.error('getRGBColorForAtl08ClassValue invalid value:',value);
//         return 'White'; // Return White for invalid values
//     }
//     const c = useColorMapStore().atl08ClassColorMap[ndx];
//     return c;
// };
