<script setup lang="ts">
import { ref } from 'vue';
import { drawGeoJson,zoomOutToFullMap } from '@/utils/SrMapUtils';
import FileUpload from 'primevue/fileupload';
import ProgressBar from 'primevue/progressbar';
import Button from 'primevue/button';
import SrToast from 'primevue/toast';
import { useToast } from "primevue/usetoast";
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { convexHull, isClockwise } from "@/composables/SrTurfUtils";
import { useReqParamsStore } from '@/stores/reqParamsStore';
import type { SrLatLon, SrRegion } from "@/sliderule/icesat2"
import { Map as OLMapType} from "ol";
import { Layer as OLlayer } from 'ol/layer';
import { useMapStore } from '@/stores/mapStore';
import type { FileUploadUploaderEvent } from 'primevue/fileupload';
import GeoJSON from 'ol/format/GeoJSON'; // Make sure this is imported at the top

const props = defineProps({
    reportUploadProgress: {
        type: Boolean,
        default: false
    },
    label: {
        type: String,
        default: 'Upload GeoJSON File'
    },
    loadReqPoly: {
        type: Boolean,
        default: false
    }

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
    let drawExtent = [] as number[] | undefined;
    if (file) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onerror = (e) => {
            console.error('Error reading file:', e);
            toast.add({ severity: 'error', summary: 'File Read Error', detail: 'Error reading the uploaded file', group: 'headless' });
        };
        reader.onload = async (e) => {
            let loadedReqPoly = false;

            const map = mapStore.getMap() as OLMapType;
            try {
                if (e.target === null) {
                    console.error('e.target is null');
                    return;
                } else {
                    if (typeof e.target.result === 'string') {
                        const geoJsonData = JSON.parse(e.target.result);
                        geoJsonStore.setGeoJsonData(geoJsonData);
                        //toast.add({ severity: 'info', summary: 'File Parse', detail: ' successfully parsed', life: 3000 });
                        if(map){
                            let vectorLayer;
                            let color: string = 'rgba(0, 0, 255, 1)'; // default color
                            if(props.loadReqPoly){
                                vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');
                                color = 'rgba(255, 0, 0, 1)'; // red
                            } else {
                                vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Uploaded Features');
                                color = 'rgba(180, 100, 0, 1)'; // dark orange
                            }
                            if(vectorLayer && vectorLayer instanceof OLlayer){
                                const vectorSource = vectorLayer.getSource();
                                if(vectorSource){
                                    drawExtent = drawGeoJson('fromFile',vectorSource, geoJsonData, color, true, true); // noFill, zoomTo = true
                                    //console.log('returned from drawGeoJson');   
                                    if(props.loadReqPoly){
                                        if(!geoJsonData.features || geoJsonData.features.length === 0) {
                                            console.error('GeoJSON file has no features');
                                            toast.add({ severity: 'error', summary: 'GeoJSON Error', detail: 'GeoJSON file has no features', group: 'headless' });
                                        } else if(geoJsonData.features.length > 1) {
                                            console.warn('GeoJSON file has multiple features only one feature with a polygon is allowed for requests');
                                            toast.add({ severity: 'error', summary: 'Multiple Features Warning', detail: 'GeoJSON file has multiple features, only one polygon is allow for requests', group: 'headless' });
                                        } else {
                                            const geometry = geoJsonData.features[0].geometry;

                                            let srLonLatCoordinates: SrRegion = [];
                                            if (geometry.type === 'Polygon') {
                                                srLonLatCoordinates = geometry.coordinates[0].map((coord: number[]) => ({
                                                    lon: coord[0],
                                                    lat: coord[1]
                                                }));
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
                                                    drawExtent = drawGeoJson('convexHull',vectorSource,JSON.stringify(geoJson),'rgba(255, 0, 0, 1)',false,true,label); // with Fill and overlayExisting
                                                    reqParamsStore.poly = reqParamsStore.convexHull;
                                                    loadedReqPoly = true;
                                                }
                                            } catch (error) {
                                                console.error('Error calculating convex hull of region:', error);
                                                toast.add({ severity: 'error', summary: 'Convex Hull Error', detail: `Error calculating convex hull for region: ${error}`, group: 'headless' });
                                            }
                                        }
                                    } else {
                                       // load all features from the GeoJSON file
                                        if (geoJsonData.features && geoJsonData.features.length > 0) {
                                            // Clear existing features in the vector source
                                            vectorSource.clear();
                                            // Add new features to the vector source
                                            const format = new GeoJSON();
                                            const features = format.readFeatures(geoJsonData, {
                                                dataProjection: 'EPSG:4326',
                                                featureProjection: map.getView().getProjection()
                                            });

                                            vectorSource.clear(); // Optionally clear any old features
                                            vectorSource.addFeatures(features);
                                        } else {
                                            console.error('GeoJSON file has no features');
                                            toast.add({ severity: 'error', summary: 'GeoJSON Error', detail: 'GeoJSON file has no features', group: 'headless' });
                                        } 
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
            if (loadedReqPoly) {
                //toast.add({ severity: 'success', summary: 'File Upload', detail: 'GeoJSON file successfully uploaded and parsed', group: 'headless' });
            } else {
                if(drawExtent){
                    // Fit the view to the extent
                    const view = map.getView();
                    view.fit(drawExtent, {
                        size: map.getSize(),
                        padding: [40, 40, 40, 40],
                    });                    
                } else {
                    console.log('GeoJSON file uploaded AND no request polygon or other features loaded');
                    zoomOutToFullMap(map)
                }
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
                        :chooseLabel="label"
                        @uploader="customUploader"
                        @select="onSelect"
                        @error="onError"
                        @clear="onClear"
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
