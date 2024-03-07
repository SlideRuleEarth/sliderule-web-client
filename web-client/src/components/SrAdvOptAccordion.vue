
<template>
    <div class="adv-opt-card">
        <h4 class="adv-opt-header">{{props.title}} for {{ props.mission.value }}</h4>
        <Accordion :multiple="true" expandIcon="pi pi-plus" collapseIcon="pi pi-minus" >
            <AccordionTab header="General" >
                <SrMenuInput
                    v-model="polygonSource"
                    label = "Polygon Source:"
                    :menuOptions="polygonSourceItems"
                    initial-value="Draw on Map"
                />
                <div class="card poly-file-upload">
                    <FileUpload v-if="polygonSource.value==='File'" mode="basic" name="demo[]" url="/api/upload" accept="image/*" :maxFileSize="1000000" @upload="onUpload" />
                </div>
            </AccordionTab>
            <AccordionTab header="Granule Selection" v-if="mission.value==='IceSat-2'" >

            </AccordionTab>
            <AccordionTab header="Photon Selection"  v-if="mission.value==='IceSat-2'" >

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

<script setup lang="ts">
import { onMounted,ref } from 'vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import SrMenuInput from './SrMenuInput.vue';
import FileUpload from 'primevue/fileupload';
import { useToast } from "primevue/usetoast";
const toast = useToast();
import { useSrToastStore } from "@/stores/srToastStore.js";
const srToastStore = useSrToastStore();

const onUpload = () => {
    // there is a nice progress bar here: https://primevue.org/toast/#headless 
    toast.add({ severity: 'info', summary: 'Success', detail: 'File Uploaded',  life: srToastStore.getLife()});
};

interface Props {
  title: string;
  ariaTitle: string;
  mission: {name:string,value:string};
  iceSat2SelectedAPI:  {name:string,value:string};
  gediSelectedAPI:  {name:string,value:string};
}

const props = defineProps<Props>();

const polygonSource = ref({name:'Polygon Source',value:'Draw on Map'});
const polygonSourceItems = ref([{name:'Polygon Source',value:'Draw on Map'},{name:'Polygon Source',value:'File'}]);

onMounted(() => {
    console.log('Mounted SrAdvOptAccordian');
});

</script>
<style scoped>

.adv-opt-header {
    justify-content: center;
}

.adv-opt-card {
    padding: 0.1250rem;
    margin: 0.1250rem;
    /* background-color: transparent;
    border-radius: var(--border-radius);
    border-width: 3px;
    border-color: var(--primary-100);
    border-style: inset; */
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

.poly-file-upload { /* card flex justify-content-center */ 
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
}
</style>
