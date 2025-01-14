import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
import { computed,ref } from 'vue';

const atl03ColorMapStore = useAtl03ColorMapStore();

// Predefined list of CSS color names
export const cssColorNames = [
    "AliceBlue", "AntiqueWhite", "Aqua", "Aquamarine", "Azure", "Beige", "Bisque", "Black",
    "BlanchedAlmond", "Blue", "BlueViolet", "Brown", "BurlyWood", "CadetBlue", "Chartreuse",
    "Chocolate", "Coral", "CornflowerBlue", "Cornsilk", "Crimson", "Cyan", "DarkBlue", 
    "DarkCyan", "DarkGoldenRod", "DarkGray", "DarkGreen", "DarkKhaki", "DarkMagenta", 
    "DarkOliveGreen", "DarkOrange", "DarkOrchid", "DarkRed", "DarkSalmon", "DarkSeaGreen", 
    "DarkSlateBlue", "DarkSlateGray", "DarkTurquoise", "DarkViolet", "DeepPink", "DeepSkyBlue",
    "DimGray", "DodgerBlue", "FireBrick", "FloralWhite", "ForestGreen", "Fuchsia", "Gainsboro",
    "GhostWhite", "Gold", "GoldenRod", "Gray", "Green", "GreenYellow", "HoneyDew", "HotPink",
    "IndianRed", "Indigo", "Ivory", "Khaki", "Lavender", "LavenderBlush", "LawnGreen",
    "LemonChiffon", "LightBlue", "LightCoral", "LightCyan", "LightGoldenRodYellow", "LightGray",
    "LightGreen", "LightPink", "LightSalmon", "LightSeaGreen", "LightSkyBlue", "LightSlateGray",
    "LightSteelBlue", "LightYellow", "Lime", "LimeGreen", "Linen", "Magenta", "Maroon", "MediumAquaMarine",
    "MediumBlue", "MediumOrchid", "MediumPurple", "MediumSeaGreen", "MediumSlateBlue", 
    "MediumSpringGreen", "MediumTurquoise", "MediumVioletRed", "MidnightBlue", "MintCream",
    "MistyRose", "Moccasin", "NavajoWhite", "Navy", "OldLace", "Olive", "OliveDrab", "Orange",
    "OrangeRed", "Orchid", "PaleGoldenRod", "PaleGreen", "PaleTurquoise", "PaleVioletRed", 
    "PapayaWhip", "PeachPuff", "Peru", "Pink", "Plum", "PowderBlue", "Purple", "RebeccaPurple",
    "Red", "RosyBrown", "RoyalBlue", "SaddleBrown", "Salmon", "SandyBrown", "SeaGreen", "SeaShell",
    "Sienna", "Silver", "SkyBlue", "SlateBlue", "SlateGray", "Snow", "SpringGreen", "SteelBlue",
    "Tan", "Teal", "Thistle", "Tomato", "Turquoise", "Violet", "Wheat", "White", "WhiteSmoke",
    "Yellow", "YellowGreen"
];

export const srColorMapNames = [
    'viridis','jet', 'hsv','hot','cool','spring','summer','autumn','winter','bone',
    'copper','greys','YIGnBu','greens','YIOrRd','bluered','RdBu','picnic',
    'rainbow','portland','blackbody','earth','electric',
    'inferno', 'magma', 'plasma', 'warm', 'cool', 'rainbow-soft',
    'bathymetry', 'cdom', 'chlorophyll', 'density', 'freesurface-blue',
    'freesurface-red', 'oxygen', 'par', 'phase', 'salinity', 'temperature', 
    'turbidity', 'velocity-blue', 'velocity-green','cubehelix'
];

export const selectedColors = computed({
    get: () => atl03ColorMapStore.getNamedColorPalette(),
    set: (value) => atl03ColorMapStore.setNamedColorPalette(value)
});

// Initialize the source and target lists for the PickList
export const srColorTable = ref([
    cssColorNames.map(color => ({ label: color, value: color })),
    selectedColors.value.map(color => ({ label: color, value: color }))
]);

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

export const restoreAtl03DefaultColors = async () => {
    try{
        await atl03ColorMapStore.restoreDefaultAtl03CnfColorMap();
        console.log('SrColorPalette colors:', atl03ColorMapStore.getNamedColorPalette());
    } catch (error) {
        console.error('Error restoring default colors:', error);
    }
};

export interface SrRGBColor {
    r: number;
    g: number;
    b: number;
}