<script setup lang="ts">
import SingleColumnLayout from '@/layouts/SingleColumnLayout.vue'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import SrClearCache from '@/components/SrClearCache.vue'
import SrSysConfig from '@/components/SrSysConfig.vue'
import SrStorageUsage from '@/components/SrStorageUsage.vue'
import SrAdvOptPanel from '@/components/SrAdvOptPanel.vue'
import SrDefaults from '@/components/SrDefaults.vue'
import SrGoogleApiKeyInput from '@/components/SrGoogleApiKeyInput.vue'
import SrArcgisApiKeyInput from '@/components/SrArcgisApiKeyInput.vue'
import Card from 'primevue/card'
</script>

<template>
  <SingleColumnLayout>
    <template v-slot:sr-single-col>
      <Card class="sr-settings-opt-card">
        <template #title>
          <div class="sr-settings-title">Settings</div>
        </template>
        <template #content>
          <div class="sr-settings-opt-wrapper">
            <Accordion
              class="sr-settings-accordion"
              :multiple="true"
              expandIcon="pi pi-plus"
              collapseIcon="pi pi-minus"
            >
              <AccordionPanel value="0">
                <AccordionHeader>System Configuration</AccordionHeader>
                <AccordionContent>
                  <SrSysConfig />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel value="1">
                <AccordionHeader>Map Provider API Keys</AccordionHeader>
                <AccordionContent>
                  <div class="sr-api-keys-section">
                    <h4>Google Maps</h4>
                    <SrGoogleApiKeyInput />
                  </div>
                  <div class="sr-api-keys-section">
                    <h4>ArcGIS Developer</h4>
                    <SrArcgisApiKeyInput />
                  </div>
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel value="2">
                <AccordionHeader>Storage Usage</AccordionHeader>
                <AccordionContent>
                  <SrStorageUsage />
                  <SrClearCache />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel value="3">
                <AccordionHeader>Advanced</AccordionHeader>
                <AccordionContent>
                  <SrAdvOptPanel />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel value="4">
                <AccordionHeader>Defaults</AccordionHeader>
                <AccordionContent>
                  <SrDefaults />
                </AccordionContent>
              </AccordionPanel>

              <!-- <AccordionPanel value="5">
                    <AccordionHeader>Color Defaults</AccordionHeader>
                    <AccordionContent>
                        <SrColorPalette />
                    </AccordionContent>
                </AccordionPanel> -->
            </Accordion>
          </div>
        </template>
      </Card>
    </template>
  </SingleColumnLayout>
</template>

<style scoped>
/* Ensure consistent width of settings panel */
.sr-settings-opt-card {
  display: block;
  justify-content: center;
  align-items: center;
  width: 40rem; /* Adjust as needed */
  margin: 0 auto;
  padding: 1rem;
  background: var(--surface-ground, black);
  border-radius: 10px;
  box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.08);
}
.sr-settings-title {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.5rem; /* Adjust as needed */
  font-weight: bold;
  text-align: center;
  width: 100%;
  margin-bottom: 1rem;
}

/* Ensure wrapper maintains width */
.sr-settings-opt-wrapper {
  width: 100%;
  max-width: 100%; /* Prevent expansion */
  margin: 1rem;
  padding: 1rem;
}

/* Accordion must keep a fixed width */
.sr-settings-accordion {
  width: 100%;
  max-width: 100%;
  width: 40rem;
}

/* Prevent content from making accordion wider */
:deep(.p-accordion-content) {
  overflow: hidden; /* Prevents expanding width */
  word-wrap: break-word; /* Ensures long words don’t break layout */
  width: 100%;
}

/* Ensure accordion panels do not change width when expanded */
:deep(.p-accordion-panel) {
  width: 100%;
  max-width: 100%;
}

/* API Keys sections styling */
.sr-api-keys-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--surface-200);
}

.sr-api-keys-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.sr-api-keys-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}
</style>
