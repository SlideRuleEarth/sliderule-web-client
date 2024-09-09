<script setup lang="ts">
import { ref, withDefaults, defineProps } from 'vue';
import { drawGeoJson } from '@/utils/SrMapUtils';
import FileUpload from 'primevue/fileupload';
import ProgressBar from 'primevue/progressbar';
import Button from 'primevue/button';
import SrToast from 'primevue/toast';
import { useToast } from "primevue/usetoast";
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { convexHull, isClockwise } from "@/composables/SrTurfUtils";
import { useReqParamsStore } from '@/stores/reqParamsStore';
import type { SrRegion } from "@/sliderule/icesat2"


const props = defineProps({
    reportUploadProgress: {
        type: Boolean,
        default: false
    },
});

const toast = useToast();
const geoJsonStore = useGeoJsonStore();
const reqParamsStore = useReqParamsStore();

////////////// upload toast items
const upload_progress_visible = ref(false);
const upload_progress = ref(0);
//////////////

const customUploader = async (event: any) => {
    console.log('GeoJson customUploader event:', event);
    const file = event.files[0];
    if (file) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = async (e) => {
            try {
                if (e.target === null) {
                    console.error('e.target is null');
                    return;
                } else {
                    if (typeof e.target.result === 'string') {
                        const geoJsonData = JSON.parse(e.target.result);
                        geoJsonStore.setGeoJsonData(geoJsonData);
                        toast.add({ severity: 'info', summary: 'File Parse', detail: 'Geojson file successfully parsed', life: 3000 });
                        drawGeoJson(geoJsonData, true, false); // noFill, !overlayExisting i.e. clear existing

                        const srLonLatCoordinates: SrRegion = geoJsonData.features[0].geometry.coordinates[0].map((coord: number[]) => {
                            return { lon: coord[0], lat: coord[1] };
                        });
                        if (isClockwise(srLonLatCoordinates)) {
                            reqParamsStore.poly = srLonLatCoordinates.reverse();
                        } else {
                            reqParamsStore.poly = srLonLatCoordinates;
                        }
                        reqParamsStore.convexHull = convexHull(srLonLatCoordinates);
                        const geoJson = {
                            type: "Feature",
                            geometry: {
                                type: "Polygon",
                                coordinates: [reqParamsStore.convexHull.map(coord => [coord.lon, coord.lat])]
                            },
                            properties: {
                                name: "Convex Hull Polygon"
                            }
                        };
                        drawGeoJson(JSON.stringify(geoJson)); // with Fill and overlayExisting
                    } else {
                        console.error('Error parsing GeoJSON:', e.target.result);
                        toast.add({ severity: 'error', summary: 'Failed to parse geo json file', group: 'headless' });
                    }
                }
            } catch (error) {
                console.error('Error parsing GeoJSON:', error);
                toast.add({ severity: 'error', summary: 'Failed to parse geo json file', group: 'headless' });
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
    </div>
</template>

<style scoped>

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
