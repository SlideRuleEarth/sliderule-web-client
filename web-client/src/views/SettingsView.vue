<script setup lang="ts">

import SingleColumnLayout from '@/layouts/SingleColumnLayout.vue';
import Accordion from 'primevue/accordion';
import AccordionPanel from 'primevue/accordionpanel';
import AccordionHeader from 'primevue/accordionheader';
import AccordionContent from 'primevue/accordioncontent';
import SrColorPalette from '@/components/SrColorPalette.vue';
import SrClearCache from '@/components/SrClearCache.vue';
import SrSysConfig from '@/components/SrSysConfig.vue';
import SrStorageUsage from  '@/components/SrStorageUsage.vue';
import SrAdvOptPanel from '@/components/SrAdvOptPanel.vue';
import {ref } from 'vue';

const expandedPanels = ref<number[]>([]);

</script>



<template>
  <SingleColumnLayout>
    <template v-slot:sr-single-col>
      <h1>Settings</h1>
      <div class="sr-settings-opt-card">
        <div class="sr-settings-opt-wrapper">
            <Accordion class="sr-settings-accordian" :multiple="true" expandIcon="pi pi-plus" collapseIcon="pi pi-minus" >
                <AccordionPanel value="0">
                    <AccordionHeader>System Configuration</AccordionHeader>
                    <AccordionContent>
                        <SrSysConfig />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="1">
                    <AccordionHeader>Storage Usage</AccordionHeader>
                    <AccordionContent>
                        <SrStorageUsage />
                        <SrClearCache />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="2">
                    <AccordionHeader>Advanced</AccordionHeader>
                    <AccordionContent>
                        <SrAdvOptPanel />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="3">
                    <AccordionHeader>Color Defaults</AccordionHeader>
                    <AccordionContent>
                        <SrColorPalette />
                    </AccordionContent>
                </AccordionPanel>
            </Accordion>
        </div>
    </div>

    </template>
  </SingleColumnLayout>
</template>

<style scoped>
.sr-settings-opt-header {
    justify-content: center;
    align-items: center;
    margin-top: 0rem;
}

.sr-settings-opt-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
.sr-settings-opt-wrapper{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
}
.sr-settings-accordian {
    width: 100%;
}

</style>
