<template>
    <div>
        <!-- Trigger -->
        <Button
            icon="pi pi-sliders-h"
            :label="iconOnly ? '' : 'Choose Polygon Source'"
            class="sr-glow-button  p-button-icon-only"
            @click="showDialog = true"
            variant="text"
            aria-label="Open Polygon Source dialog"
        />

        <!-- Dialog -->
        <Dialog
            v-model:visible="showDialog"
            header="Region of Interest"
            modal
            :closable="true"
            :dismissableMask="true"
            :breakpoints="{ '960px': '50vw', '640px': '90vw' }"
            style="width: 35rem"
            @hide="$emit('close')"
            @show="$emit('open')"
        >
            <div class="p-fluid">
                <SrMenu
                    v-model="mapStore.polygonSource"
                    label="Polygon Source"
                    aria-label="Select Polygon Source"
                    :menuOptions="mapStore.polygonSourceItems"
                    :getSelectedMenuItem="mapStore.getPolySource"
                    :setSelectedMenuItem="mapStore.setPolySource"
                    tooltipText="This is how you define the region of interest"
                    tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#polygons"
                />
                <SrGeoJsonFileUpload
                    v-if="mapStore.polygonSource==='GeoJSON File'"
                    :loadReqPoly="true"
                    :reportUploadProgress="true"
                />
                <SrSliderInput
                    v-if="mapStore.polygonSource==='GeoJSON File'"
                    label="Rasterize Polygon cell size"
                    unitsLabel="Degrees"
                    v-model="reqParamsStore.rasterizePolyCellSize"
                    :getValue="reqParamsStore.getRasterizePolyCellSize"
                    :setValue="reqParamsStore.setRasterizePolyCellSize"
                    :min="0.0001"
                    :max="1.0"
                    :decimalPlaces="4"
                    tooltipText="The number of pixels to rasterize the polygon into"
                    tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#rasterized-area-of-interest"
                />
            </div>

            <template #footer>
                <Button
                    label="Close"
                    severity="secondary"
                    @click="showDialog = false"
                />
            </template>
        </Dialog>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import { useMapStore } from '@/stores/mapStore';
import SrMenu from '@/components/SrMenu.vue';
import SrGeoJsonFileUpload from '@/components/SrGeoJsonFileUpload.vue';
import SrSliderInput from '@/components/SrSliderInput.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';

const props = defineProps({
    iconOnly: {
        type: Boolean,
        default: false
    }
});

const mapStore = useMapStore();
const reqParamsStore = useReqParamsStore();

const showDialog = ref(false);

defineEmits<{
    (e: 'open'): void;
    (e: 'close'): void;
}>();
</script>

<style scoped>
.p-fluid :deep(.sr-form-row) {
    margin-bottom: 0.75rem;
}
</style>
