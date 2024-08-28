
export const colorMapNames = [
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
    const options = colorMapNames.map(name => {
        return {
            name: name,
            value: name
        };
    });

    return options;
}

