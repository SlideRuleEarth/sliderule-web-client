<script setup lang="ts">
import { ref } from 'vue';
import { drawGeoJson,zoomOutToFullMap } from '@/utils/SrMapUtils';
import FileUpload from 'primevue/fileupload';
import ProgressBar from 'primevue/progressbar';
import Button from 'primevue/button';
import SrToast from 'primevue/toast';
import SrSliderInput from './SrSliderInput.vue';
import { useToast } from "primevue/usetoast";
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { convexHull, isClockwise } from "@/composables/SrTurfUtils";
import { useReqParamsStore } from '@/stores/reqParamsStore';
import type { SrRegion } from "@/sliderule/icesat2"
import { Map as OLMapType} from "ol";
import { Layer as OLlayer } from 'ol/layer';
import { useMapStore } from '@/stores/mapStore';
import type { FileUploadUploaderEvent } from 'primevue/fileupload';

const props = defineProps({
    reportUploadProgress: {
        type: Boolean,
        default: false
    },

});

const mapStore = useMapStore();
const toast = useToast();
const geoJsonStore = useGeoJsonStore();
const reqParamsStore = useReqParamsStore();

////////////// upload toast items
const upload_progress_visible = ref(false);
const upload_progress = ref(0);
//////////////

const customUploader = async (event: FileUploadUploaderEvent) => {
    console.log('GeoJson customUploader event:', event);
    const files = Array.isArray(event.files) ? event.files : [event.files];
    const file = files[0];
    if (file) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onerror = (e) => {
            console.error('Error reading file:', e);
            toast.add({ severity: 'error', summary: 'File Read Error', detail: 'Error reading the uploaded file', group: 'headless' });
        };
        reader.onload = async (e) => {
            let success = false;
            const map = mapStore.getMap() as OLMapType;
            try {
                if (e.target === null) {
                    console.error('e.target is null');
                    return;
                } else {
                    if (typeof e.target.result === 'string') {
                        const geoJsonData = JSON.parse(e.target.result);
                        geoJsonStore.setGeoJsonData(geoJsonData);
                        //toast.add({ severity: 'info', summary: 'File Parse', detail: 'Geojson file successfully parsed', life: 3000 });
                        if(map){
                            const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');
                            if(vectorLayer && vectorLayer instanceof OLlayer){
                                const vectorSource = vectorLayer.getSource();
                                if(vectorSource){
                                    drawGeoJson('fromFile',vectorSource, geoJsonData, true, true); // noFill, zoomTo = true
                                    console.log('returned from drawGeoJson');   


                                    const geometry = geoJsonData.features[0].geometry;

                                    let srLonLatCoordinates: SrRegion = [];

                                    if (geometry.type === 'Polygon') {
                                        srLonLatCoordinates = geometry.coordinates[0].map((coord: number[]) => ({
                                            lon: coord[0],
                                            lat: coord[1]
                                        }));
                                    } else if (geometry.type === 'LineString') {
                                        srLonLatCoordinates = geometry.coordinates.map((coord: number[]) => ({
                                            lon: coord[0],
                                            lat: coord[1]
                                        }));
                                    } else if (geometry.type === 'Point') {
                                        const [lon, lat] = geometry.coordinates;
                                        srLonLatCoordinates = [{ lon, lat }];
                                    } else {
                                        console.error('Unsupported geometry type:', geometry.type);
                                        toast.add({ severity: 'error', summary: 'Unsupported GeoJSON geometry type', detail: geometry.type, group: 'headless' });
                                    }
                                   try{
                                        if(srLonLatCoordinates && srLonLatCoordinates.length < 3) {
                                            console.error('A Region to use in request requires at least 3 points, but got:', srLonLatCoordinates.length);
                                            toast.add({ severity: 'error', summary: 'Convex Hull Error', detail: `A Region to use in request requires at least 3 points, but got: ${srLonLatCoordinates.length}`, group: 'headless' });
                                        } else {
                                            if (isClockwise(srLonLatCoordinates)) {
                                                reqParamsStore.poly = srLonLatCoordinates.reverse();
                                            } else {
                                                reqParamsStore.poly = srLonLatCoordinates;
                                            }
                                            console.log('calling convexHull');
                                            reqParamsStore.setConvexHull(convexHull(srLonLatCoordinates));
                                            const geoJson = {
                                                type: "Feature",
                                                geometry: {
                                                    type: "Polygon",
                                                    coordinates: [reqParamsStore.getConvexHull()?.map(coord => [coord.lon, coord.lat])]
                                                },
                                                properties: {
                                                    name: "Convex Hull Polygon"
                                                }
                                            };
                                            const label = reqParamsStore.getFormattedAreaOfConvexHull().toString();
                                            drawGeoJson('convexHull',vectorSource,JSON.stringify(geoJson),false,true,label); // with Fill and overlayExisting
                                            reqParamsStore.poly = reqParamsStore.convexHull;
                                            success = true;
                                        }
                                    } catch (error) {
                                        console.error('Error calculating convex hull of region:', error);
                                        toast.add({ severity: 'error', summary: 'Convex Hull Error', detail: `Error calculating convex hull for region: ${error}`, group: 'headless' });
                                    }
                                } else {
                                    console.error('Error parsing GeoJSON:', e.target.result);
                                    toast.add({ severity: 'error', summary: 'error with map source object', group: 'headless' });
                                }
                            } else {
                                console.error('Error parsing GeoJSON:', e.target.result);
                                toast.add({ severity: 'error', summary: 'error with layers', group: 'headless' });
                            }
                        } else {
                            console.error('Error parsing GeoJSON:', e.target.result);
                            toast.add({ severity: 'error', summary: 'error with map', group: 'headless' });
                        }
                    } else {
                        console.error('Error parsing GeoJSON:', e.target.result);
                        toast.add({ severity: 'error', summary: 'error with filereader', group: 'headless' });
                    }
                }
            } catch (error) {
                console.error('Error parsing GeoJSON:', error);
                toast.add({ severity: 'error', summary: `error: caught exception:${error}`, group: 'headless' });
            }
            if (success) {
                //toast.add({ severity: 'success', summary: 'File Upload', detail: 'GeoJSON file successfully uploaded and parsed', group: 'headless' });
            } else {
                zoomOutToFullMap(map)
            }
        };

        // Conditionally report upload progress
        if (props.reportUploadProgress) {
            reader.onprogress = (e) => {
                console.log('onprogress e:', e);
                if (e.lengthComputable) {
                    const percentLoaded = Math.round((e.loaded / e.total) * 100);
                    upload_progress.value = percentLoaded;
                    if (!upload_progress_visible.value) {
                        upload_progress_visible.value = true;
                        toast.add({ severity: 'info', summary: 'Upload progress', group: 'headless' });
                    }
                }
            };
        }
    } else {
        console.error('No file input found');
        toast.add({ severity: 'error', summary: 'No file input found', group: 'headless' });
    }
};

const onSelect = (e: any) => {
    console.log('onSelect e:', e);
};

const onError = (e: any) => {
    console.log('onError e:', e);
    toast.add({ severity: 'error', summary: 'Upload Error', detail: 'Error uploading file', group: 'headless' });
};

const onClear = () => {
    console.log('onClear');
};

</script>

<template>
    <div class="file-upload-panel">
        <SrToast position="top-center" group="headless" @close="upload_progress_visible = false">
            <template #container="{ message, closeCallback }">
                <section class="toast-container">
                    <i class="upload-icon"></i>
                    <div class="message-container">
                        <p class="summary">{{ message.summary }}</p>
                        <p class="detail">{{ message.detail }}</p>
                        <div class="progress-container" v-if="reportUploadProgress">
                            <ProgressBar :value="upload_progress" :showValue="false" class="progress-bar"></ProgressBar>
                            <label class="upload-percentage">{{ upload_progress }}% uploaded...</label>
                        </div>
                        <div class="button-container">
                            <Button label="Done" text class="done-btn" @click="closeCallback"></Button>
                        </div>
                    </div>
                </section>
            </template>
        </SrToast>
        <div class="sr-file-upload">
            <FileUpload mode="basic" 
                        name="SrFileUploads[]" 
                        :auto="true" 
                        accept=".geojson,.json" 
                        :maxFileSize="10000000000" 
                        customUpload 
                        @uploader="customUploader"
                        @select="onSelect"
                        @error="onError"
                        @clear="onClear"
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
                tooltipText="The number of pixels to rasterize the polygon into"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/GeoRaster.html#georaster"
            />
    </div>
    </div>
</template>

<style scoped>

.sr-file-upload {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
}

.file-upload-panel { 
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
}
:deep(.p-progressbar-label){
    color: var(--p-text-color);
}
.toast-container {
    display: flex;
    padding: 1rem; /* 12px 3rem in bootstrap, adjust accordingly */
    gap: 1rem; /* adjust as needed */
    width: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    border-radius: var(--p-border-radius);
}

.upload-icon {
    /* Styles for pi pi-cloud-upload */
    color: var(--p-primary-color); /* primary-500 color  #2c7be5;*/
    font-size: 1.5rem; /* 2xl size */
}

.message-container {
    display: flex;
    flex-direction: column;
    gap: 1rem; /* adjust as needed */
    width: 100%;
}

.summary, .detail {
    margin: 0;
    font-weight: 600; /* font-semibold */
    font-size: 1rem; /* text-base */
    color: #ffffff;
}

.detail {
    color: var(--p-text-color); /* text-700 color, adjust as needed */
}

.progress-container {
    display: flex;
    flex-direction: column;
    gap: 8px; /* adjust as needed */
}

.progress-bar {
    height: 4px;
}

.upload-percentage {
    text-align: right;
    font-size: 0.75rem; /* text-xs */
    color:var(--p-text-color);
}

</style>
