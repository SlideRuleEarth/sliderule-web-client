
<template>
    <div class="adv-opt-card">
        <h4 class="adv-opt-header">{{props.title}} for {{ props.mission }}</h4>
        <Accordion :multiple="true" expandIcon="pi pi-plus" collapseIcon="pi pi-minus" >
            <AccordionTab header="General" >
                <SrMenuInput
                    v-model="polygonSource"
                    label = "Polygon Source:"
                    :menuOptions="polygonSourceItems"
                    initial-value="Draw"
                />
            </AccordionTab>
            <AccordionTab header="Granule Selection" v-if="mission==='IceSat-2'" >

            </AccordionTab>
            <AccordionTab header="Photon Selection"  v-if="mission==='IceSat-2'" >

            </AccordionTab>
            <AccordionTab header="Extents" v-if="mission==='IceSat-2'" >

            </AccordionTab>
            <AccordionTab header="Surface Elevation" v-if="mission==='IceSat-2' && iceSat2SelectedAPI==='atl06'"  > 

            </AccordionTab>
            <AccordionTab header="Veg Density Alg" v-if="mission==='IceSat-2' && iceSat2SelectedAPI==='atl08'" >
            </AccordionTab>
            <AccordionTab header="Ancillary Fields"  v-if="mission==='IceSat-2'" >

            </AccordionTab>
            <AccordionTab header="GEDI Footprint"  v-if="mission==='GEDI'" >

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


interface Props {
  title: string;
  ariaTitle: string;
  mission: string;
  iceSat2SelectedAPI: string;
  gediSelectedAPI: string;
}

const props = defineProps<Props>();

const polygonSource = ref('Draw');
const polygonSourceItems = ref([
    { value: 'Draw', label: 'Draw On Map' },
    { value: 'File', label: 'Upload File' },
]);


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


</style>
