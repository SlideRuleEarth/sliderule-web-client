
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

type ColorArray = string[]; // Or [number, number, number, number][] for rgba

export function createUnifiedColorMapper(options: {
    colorMap: ColorArray;
    min: number;
    max: number;
    valueAccessor: (_input: any) => number;
}) {
    const { colorMap, valueAccessor } = options;
    // Convert BigInt to Number if necessary
    const min = typeof options.min === 'bigint' ? Number(options.min) : options.min;
    const max = typeof options.max === 'bigint' ? Number(options.max) : options.max;
    const numShades = colorMap.length;
    const range = max - min;
    const scale = (numShades - 1) / range;

    return (input: any): string => {
        const value = valueAccessor(input);

        if (isNaN(value)) return colorMap[0]; // Fallback for bad input
        if (value <= min) return colorMap[0];
        if (value >= max) return colorMap[numShades - 1];

        const index = Math.floor((value - min) * scale);
        return colorMap[index];
    };
}

export function createUnifiedColorMapperRGBA(options: {
    colorMap: number[][];
    min: number;
    max: number;
    valueAccessor: (_input: any) => number;
}): (_input: any) => [number, number, number, number] {
    const { colorMap, valueAccessor } = options;
    // Convert BigInt to Number if necessary
    const min = typeof options.min === 'bigint' ? Number(options.min) : options.min;
    const max = typeof options.max === 'bigint' ? Number(options.max) : options.max;
    const numShades = colorMap.length;
    const range = max - min;
    const scale = (numShades - 1) / range;

    return (input: any): [number, number, number, number] => {
        const value = valueAccessor(input);
        const defaultColor: [number, number, number, number] = [255, 255, 255, 255];

        if (isNaN(value)) return defaultColor;
        if (value <= min) return [...colorMap[0].slice(0, 3), 255] as [number, number, number, number];
        if (value >= max) return [...colorMap[numShades - 1].slice(0, 3), 255] as [number, number, number, number];
        
        const index = Math.floor((value - min) * scale);
        return [...colorMap[index].slice(0, 3), 255] as [number, number, number, number];

    };
}
