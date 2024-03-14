

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import SrMenuInput from './SrMenuInput.vue';
import SrMenuMultiInput from './SrMenuMultiInput.vue';
import FileUpload from 'primevue/fileupload';
import ProgressBar from 'primevue/progressbar';
import Button from 'primevue/button';
import SrMultiSelect from './SrMultiSelect.vue'
import Toast from 'primevue/toast';
import { useToast } from "primevue/usetoast";
import { useGeoJsonStore } from '../stores/geoJsonStore';
import { useMapStore } from '@/stores/mapStore';
import { polyCoordsExist } from '@/composables/SrMapUtils';
import { drawGeoJson } from '@/composables/SrMapUtils';
import SrCheckbox from './SrCheckbox.vue';
import SrSliderInput from './SrSliderInput.vue';
import SrCalendar from './SrCalendar.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrRadioButtonBox from './SrRadioButtonBox.vue';

const reqParamsStore = useReqParamsStore();


const toast = useToast();
const geoJsonStore = useGeoJsonStore();
const mapStore = useMapStore();

////////////// upload toast items
const upload_progress_visible = ref(false);
const upload_progress = ref(0);
const interval = ref();
//////////////

onUnmounted(() => {
    if (interval.value) {
        clearInterval(interval.value);
    }
})

const customUploader = async (event) => {
    console.log('customUploader event:',event);
    const file = event.files[0];
    if (file) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = async (e) => {
            try {
                if (e.target === null){
                    console.error('e.target is null');
                    return;
                } else {
                    //console.log(`e.target.result: ${e.target.result}`);
                    console.log(`e.target.result type: ${typeof e.target.result}`);
                    if (typeof e.target.result === 'string') {
                        const data = JSON.parse(e.target.result);
                        geoJsonStore.setGeoJsonData(data);
                        toast.add({ severity: "info", summary: 'File Parse', detail: 'Geojson file successfully parsed', life: 3000});
                        const tstMsg = drawGeoJson(data);
                        if (tstMsg) {
                            toast.add(tstMsg);
                        }
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

        reader.onprogress = (e) => {
            console.log('onprogress e:',e);
            if (e.lengthComputable) {
                console.log(`Uploading your file ${e.loaded} of ${e.total}`);
                const percentLoaded = Math.round((e.loaded / e.total) * 100);
                upload_progress.value = percentLoaded;
                if (!upload_progress_visible.value) {
                    upload_progress_visible.value = true;
                    toast.add({ severity: 'info', summary: 'Upload progress', group: 'headless' });
                }
            }
        };
    } else {
        console.error('No file input found');
        toast.add({ severity: 'error', summary: 'No file input found', group: 'headless' });
    };
};

const onSelect = (e) => {
    console.log('onSelect e:',e);
};

const onError = (e) => {
    console.log('onError e:',e);
    toast.add({ severity: 'error', summary: 'Upload Error', detail: 'Error uploading file', group: 'headless' });
};
const onClear = () => {
    console.log('onClear');
};


watch(mapStore.polygonSource, (newValue) => {
    console.log('polygonSource:', newValue);
    if (newValue.value === 'Draw on Map') {
        console.log('Draw on Map');
    } else if (newValue.value === 'Upload geojson File') {
        console.log('Upload geojson File');
    } else {
        console.error('Unknown polygonSource:', newValue);
    }
});

interface Props {
  title: string;
  ariaTitle: string;
  mission: {name:string,value:string};
  iceSat2SelectedAPI:  {name:string,value:string};
  gediSelectedAPI:  {name:string,value:string};
}

const props = defineProps<Props>();
const polygonSourceItems = ref([{name:'Polygon Source',value:'Draw on Map'},{name:'Polygon Source',value:'Upload geojson File'}]);

onMounted(() => {
    console.log('Mounted SrAdvOptAccordian');
});

</script>

<template>
    <div class="adv-opt-card">
        <h4 class="adv-opt-header">{{props.title}} for {{ props.mission.value }}</h4>
        <Accordion :multiple="true" expandIcon="pi pi-plus" collapseIcon="pi pi-minus" >
            <AccordionTab header="General" >
                <SrMenuInput
                    v-model="mapStore.polygonSource"
                    label = "Polygon Source:"
                    aria-label="Select Polygon Source"
                    :menuOptions="polygonSourceItems"
                    initial-value="Draw on Map"
                />
                <div class="file-upload-panel" v-if="!polyCoordsExist">
                    <Toast position="top-center" group="headless" @close="upload_progress_visible = false">
                        <template #container="{ message, closeCallback }">
                            <section class="toast-container">
                                <i class="upload-icon"></i>
                                <div class="message-container">
                                    <p class="summary">{{ message.summary }}</p>
                                    <p class="detail">{{ message.detail }}</p>
                                    <div class="progress-container">
                                        <ProgressBar :value="upload_progress" :showValue="false" class="progress-bar"></ProgressBar>
                                        <label class="upload-percentage">{{ upload_progress }}% uploaded...</label>
                                    </div>
                                    <div class="button-container">
                                        <Button label="Done" text class="done-btn" @click="closeCallback"></Button>
                                    </div>
                                </div>
                            </section>
                        </template>
                    </Toast>
                    <FileUpload v-if="mapStore.polygonSource.value==='Upload geojson File'" 
                                mode="basic" 
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
                <SrCheckbox
                    label="Rasterize Polygon:"
                    v-model="reqParamsStore.rasterizePolygon"
                />
                <SrCheckbox
                    label="Ignore Poly for CMR:"
                    v-model="reqParamsStore.ignorePolygon"
                />
                <SrSliderInput
                    v-model="reqParamsStore.reqTimeoutValue"
                    label="Req timeout:"
                    :min="5"
                    :max="3600" 
                    :decimal-places="0"
                />
            </AccordionTab>
            <AccordionTab header="Granule Selection" v-if="mission.value==='IceSat-2'" >
                <SrMenuMultiInput
                    v-model="reqParamsStore.tracks"
                    label = "Track(s):"
                    aria-label="Select Tracks"
                    :menuOptions="reqParamsStore.tracksOptions"
                    :default="reqParamsStore.tracksOptions"
                />
                <SrMenuMultiInput
                    v-model="reqParamsStore.beams"
                    label = "Beam(s):"
                    aria-label="Select Beams"
                    :menuOptions="reqParamsStore.beamsOptions"
                    :default="reqParamsStore.beamsOptions"
                />
                <SrSliderInput
                    v-model="reqParamsStore.rgtValue"
                    label="RGT:"
                    :min="1"
                    :max="100" 
                    :decimal-places="0"
                />
                <SrSliderInput
                    v-model="reqParamsStore.cycleValue"
                    label="Cycle:"
                    :min="1"
                    :max="100" 
                    :decimal-places="0"
                />
                <SrSliderInput
                    v-model="reqParamsStore.regionValue"
                    label="Region:"
                    :min="1"
                    :max="100" 
                    :decimal-places="0"
                />
                <SrCalendar
                    v-model="reqParamsStore.t0Value"
                    label="T0:"
                />
                <SrCalendar
                    v-model="reqParamsStore.t1Value"
                    label="T1:"
                />
                
            </AccordionTab>
            <AccordionTab header="Photon Selection"  v-if="mission.value==='IceSat-2'" >
                <SrMultiSelect
                    v-if="iceSat2SelectedAPI.value==='atl03'"
                    :menuOptions="reqParamsStore.surfaceTypeOptions"
                    label="Surface Type"
                    ariaLabel="Select Surface Type"
                    @update:value="reqParamsStore.surfaceType = $event"
                    :default="reqParamsStore.surfaceTypeOptions"
                />
                <SrRadioButtonBox
                    v-if="iceSat2SelectedAPI.value==='atl03'"
                    label="Signal Confidence"
                    ariaLabel="Signal Confidence"
                    :categories="reqParamsStore.signalConfidenceOptions"
                    default
                />
                <SrMultiSelect
                    v-if="iceSat2SelectedAPI.value==='atl08'"
                    :menuOptions="reqParamsStore.landTypeOptions"
                    label = "Land Type:"
                    aria-label="Select Land Type"
                    @update:value="reqParamsStore.landType = $event"
                    :default="reqParamsStore.landTypeOptions"
                />
                <SrSliderInput
                    v-if="iceSat2SelectedAPI.value==='atl03'"
                    v-model="reqParamsStore.YAPC"
                    label="YAPC:"
                />   

            </AccordionTab>
            <AccordionTab header="Extents" v-if="mission.value==='IceSat-2'" >

            </AccordionTab>
            <AccordionTab header="Surface Elevation" v-if="mission.value==='IceSat-2' && iceSat2SelectedAPI.value==='atl06'"  > 

            </AccordionTab>
            <AccordionTab header="Veg Density Alg" v-if="mission.value==='IceSat-2' && iceSat2SelectedAPI.value==='atl08'" >
            </AccordionTab>
            <AccordionTab header="Ancillary Fields"  v-if="mission.value==='IceSat-2'" >

            </AccordionTab>
            <AccordionTab header="GEDI Footprint"  v-if="mission.value==='GEDI'" >

            </AccordionTab>
            <AccordionTab header="Raster Sampling"> 
            </AccordionTab>
            <AccordionTab header="Output">

            </AccordionTab>
        </Accordion>
    </div>
</template>

<style scoped>

.adv-opt-header {
    justify-content: center;
}

.adv-opt-card {
    padding: 0.1250rem;
    margin: 0.1250rem;
}

:deep(.p-accordion .p-accordion-tab) {
    background-color: transparent;
    margin: 0.25rem;
}

:deep(.p-accordion .p-accordion-header) {
    /* display: flex; */
    background-color: transparent;
    margin-bottom: 0.0rem;
}

:deep(.p-accordion .p-accordion-tab .p-accordion-header-action) {
    background-color: transparent;
    border-width: 1px;
    margin-bottom: 0rem;
}

:deep(.p-accordion .p-accordion-tab.p-accordion-tab-active) {
    border-color: var(--primary-color);
    border-radius: var(--border-radius);
    border-width: 4px;
    margin-bottom: 0rem;
    color: var(--text-color);
}

:deep(.p-accordion-header.p-highlight){
    background-color: var(--primary-500);
    border-color: var(--primary-color);
    border-radius: var(--border-radius);
    margin-bottom: 0rem;
}
:deep(.p-accordion-header-link.p-accordion-header-action){
    /* background-color: transparent; */
    padding:0.5rem;
}

:deep(.p-accordion-content) {
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    background-color: transparent;
}

:deep(.p-button.p-component.p-fileupload-choose) {
    font-family: var(--font-family);
    background-color: transparent;
    border-color: var(--primary-100);
    border-width: 1px;
    color: white;
    border-radius: var(--border-radius);
    margin: 0.5rem;
    padding: 0.5rem;
}

.file-upload-panel { 
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
}
:deep(.p-progressbar-label){
    color: var(--text-color);
}
.toast-container {
    display: flex;
    padding: 1rem; /* 12px 3rem in bootstrap, adjust accordingly */
    gap: 1rem; /* adjust as needed */
    width: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    border-radius: var(--border-radius);
}

.upload-icon {
    /* Styles for pi pi-cloud-upload */
    color: var(--primary-color); /* primary-500 color  #2c7be5;*/
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
    color: var(--text-color); /* text-700 color, adjust as needed */
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
    color:var(--text-color);
}

.button-container {
    display: flex;
    gap: 12px; /* adjust as needed */
    margin-bottom: 12px; /* mb-3, adjust accordingly */
}

 .done-btn {
    padding: 0.25rem 0.5rem; /* py-1 px-2 */
    color: var(--text-color); 
}

</style>./SrRadioButtonBox.vue
