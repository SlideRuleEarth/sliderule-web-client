<script setup lang="ts">
import { ref, computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import { useMapStore } from '@/stores/mapStore';
import SrGeoJsonFileUpload from '@/components/SrGeoJsonFileUpload.vue';
import SrSliderInput from '@/components/SrSliderInput.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrShapefileUpload from './SrShapefileUpload.vue';
import { createLogger } from '@/utils/logger';

const logger = createLogger('SrUploadRegion');

const props = defineProps({
    reportUploadProgress: {
        type: Boolean,
        default: false
    },
    loadReqPoly: {
        type: Boolean,
        default: false
    }
});
const emit = defineEmits<{
    (e: 'open'): void;
    (e: 'close'): void;
}>();
const computedTooltipText = computed(() => props.loadReqPoly ? 'Upload a GeoJSON or Shapefile defining a polygonal region of interest' : 'Upload a GeoJSON or Shapefile defining features to add to the map');
const computedLabelText = computed(() => props.loadReqPoly ? 'Upload Region of Interest' : 'Upload Features to Map');
const mapStore = useMapStore();
const reqParamsStore = useReqParamsStore();

const showDialog = ref(false);

function openPolygonSourceDialog() {
    showDialog.value = true;
}

function handleDialogHide() {
    mapStore.setPolySource("Draw on Map");
    emit('close');
}

function handleFileUploadFinished() {
    logger.debug('GeoJSON file upload finished; closing dialog');
    showDialog.value = false;
}

</script>

<template>
    <div>
        <!-- Trigger -->
        <Button
            icon="pi pi-upload"
            class="p-button-icon-only sr-upload-region-button"
            @click="openPolygonSourceDialog"
            variant="text"
            aria-label="Open Polygon Source dialog"
            :title="computedTooltipText.value"
        />

        <!-- Dialog -->
        <Dialog
            v-model:visible="showDialog"
            :header="computedLabelText.value"
            modal
            :closable="true"
            :dismissableMask="true"
            :breakpoints="{ '960px': '50vw', '640px': '90vw' }"
            @hide="handleDialogHide"
            @show="$emit('open')"
        >
            <div class="p-fluid">

                <SrGeoJsonFileUpload
                    :loadReqPoly="props.loadReqPoly"
                    :reportUploadProgress="props.reportUploadProgress"
                    @done="handleFileUploadFinished"
                />
                <SrShapefileUpload
                    :loadReqPoly="props.loadReqPoly"
                    :reportUploadProgress="props.reportUploadProgress"
                    @done="handleFileUploadFinished"
                />
                <SrSliderInput
                    label="Rasterize Polygon cell size"
                    unitsLabel="Degrees"
                    v-model="reqParamsStore.rasterizePolyCellSize"
                    :getValue="reqParamsStore.getRasterizePolyCellSize"
                    :setValue="reqParamsStore.setRasterizePolyCellSize"
                    :min="0.0001"
                    :max="1.0"
                    :decimalPlaces="4"
                    :inputWidth="'5rem'"
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
<style scoped>

.sr-upload-region-button.p-button {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0.25rem;
}
</style>