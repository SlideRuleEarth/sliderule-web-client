<template>
    <div class="color-palette">
        <h2>Select Your Color Palette</h2>
        <PickList v-model="colors" dataKey="label">
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
    </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import PickList from 'primevue/picklist';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
const atl03ColorMapStore = useAtl03ColorMapStore();
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

// Initialize the source and target lists for the PickList
const colors = ref([
    cssColorNames.map(color => ({ label: color, value: color })),
    []
]);

onMounted(() => {
    colors.value[1] = atl03ColorMapStore.getNamedColorPalette().map(color => ({ label: color, value: color }));
    console.log('Mounted SrColorPalette colors:', colors.value);

});

watch(() => colors.value, (newVal, oldVal) => {
    console.log('SrColorPallet colors changed:', newVal);
    atl03ColorMapStore.setNamedColorPalette(newVal[1].map(color => color.value));
    console.log('SrColorPallet colors:', atl03ColorMapStore.getNamedColorPalette());
});

</script>

<style scoped>
.color-palette {
    max-width: 600px;
    margin: 0 auto;
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
</style>
