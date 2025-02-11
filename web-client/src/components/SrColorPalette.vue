<template>
    <div class="sr-color-palette">
        <Fieldset legend="Color Palette" class="sr-color-palette-content" :toggleable="true" :collapsed="false">
            <h2>Select Your Color Palette</h2>
            <PickList v-model="srColorTable" dataKey="label">
                <!-- Custom source header with different background color -->
                <template #sourceheader>
                    <div class="source-header">Available Colors</div>
                </template>
                <!-- Custom target header with different background color -->
                <template #targetheader>
                    <div class="target-header">Selected Colors</div>
                </template>
                <template #item="slotProps">
                        {{ slotProps.item.label }}
                </template>
            </PickList>
            <div class="sr-restore-defaults">
                <Button label="Restore Defaults" @click="restoreDefaultColors" />
            </div>
        </Fieldset>
    </div>
    <div class="sr-select-color-map-panel">
        <div class="sr-select-atl03-colors">
            <SrAtl03CnfColorSelection 
                @selectionChanged="atl03CnfColorChanged"
                @defaultsChanged="atl03CnfColorChanged"
            />
        </div>  
        <div class="sr-select-atl08-colors">
            <SrAtl08ClassColorSelection 
                @selectionChanged="atl08ClassColorChanged"
                @defaultsChanged="atl08ClassColorChanged"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted,computed,ref } from 'vue';
import PickList from 'primevue/picklist';
import Button from 'primevue/button';
import { useColorMapStore } from '@/stores/colorMapStore';
import Fieldset from 'primevue/fieldset';
import SrAtl03CnfColorSelection from '@/components/SrAtl03CnfColorSelection.vue';
import SrAtl08ClassColorSelection from '@/components/SrAtl08ClassColorSelection.vue';


interface AtColorChangeEvent {
  label: string;
  color?: string; // color can be undefined
}

const selectedColors = computed({
    get: () => useColorMapStore().getNamedColorPalette(),
    set: (value) => useColorMapStore().setNamedColorPalette(value)
});

// Predefined list of CSS color names
const cssColorNames = [
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

const colorMapStore = useColorMapStore();



// Initialize the source and target lists for the PickList
const srColorTable = ref([
    cssColorNames.map(color => ({ label: color, value: color })),
    selectedColors.value.map(color => ({ label: color, value: color }))
]);

onMounted(() => {
    colorMapStore.initializeColorMapStore();
    srColorTable.value[1] = colorMapStore.getNamedColorPalette().map(color => ({ label: color, value: color }));
    console.log('Mounted SrColorPalette colors:', srColorTable.value);
});

const restoreDefaultColors = async () => {
    await restoreDefaultColors();
    console.log('SrColorPalette colors:', srColorTable.value);
};  

const atl03CnfColorChanged = async (colorKey:string): Promise<void> =>{
    console.log(`atl03CnfColorChanged:`,colorKey);
};

const atl08ClassColorChanged = async ({ label, color }:AtColorChangeEvent): Promise<void> => {
    console.log(`atl08ClassColorChanged received selection change: ${label} with color ${color}`);
};

const yapcColorChanged = async (colorKey:string): Promise<void> =>{
    console.log(`yapcColorChanged:`,colorKey);
};

</script>

<style scoped>
.sr-color-palette {
    display: flex;
    justify-content: center;
    margin:0.125rem;
}
.sr-color-palette-content {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    font-size: smaller;
    padding: 0.25rem;
}

h2 {
    text-align: center;
    margin-bottom: 1rem;
}

/* Custom styles for the headers */
.source-header {
    background-color: white;
    color : black;
    padding: 10px;
    text-align: center;
    font-weight: bold;
}

.target-header {
    background-color: white;
    color : black;
    padding: 10px;
    text-align: center;
    font-weight: bold;
}
.sr-restore-defaults {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
}
</style>
