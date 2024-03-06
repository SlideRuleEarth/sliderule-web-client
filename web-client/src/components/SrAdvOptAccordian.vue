
<template>
    <div class="adv-opt-card">
        <Accordion :active-index="[0]" :multiple="true" expandIcon="pi pi-plus" collapseIcon="pi pi-minus" >
            <AccordionTab header="General" >
                <SrMenuInput
                    v-model="polygonSource"
                    label = "Polygon Source:"
                    :menuOptions="polygonSourceItems"
                    initial-value="Draw"
                />
            </AccordionTab>
            <AccordionTab header="Granule Selection">

            </AccordionTab>
            <AccordionTab header="Photon Selection">

            </AccordionTab>
            <AccordionTab header="Photon Selection">

            </AccordionTab>
            <AccordionTab header="Extents">

            </AccordionTab>
            <AccordionTab header="Surface Elevation">

            </AccordionTab>
            <AccordionTab header="Veg Density Alg">
            </AccordionTab>
            <AccordionTab header="Ancillary Fields">

            </AccordionTab>
            <AccordionTab header="GEDI Footprint">

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

:deep(.p-accordion .p-accordion-tab) {
    background-color: transparent;
    margin-bottom: 1.0rem;
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
/* "adv-opt-accordion-label"  */

</style>
