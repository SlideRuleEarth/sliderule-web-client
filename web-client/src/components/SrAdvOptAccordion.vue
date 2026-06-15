<script setup lang="ts">
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import { defineAsyncComponent, ref, computed } from 'vue'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { photonProcessingAPIs } from '@/types/SrStaticOptions'

/* eslint-disable @typescript-eslint/promise-function-async */
const SrYAPC = defineAsyncComponent(() => import('@/components/SrYAPC.vue'))
const SrAtl03Classification = defineAsyncComponent(
  () => import('@/components/SrAtl03Classification.vue')
)
const SrAtl08Cnf = defineAsyncComponent(() => import('@/components/SrAtl08Cnf.vue'))
const SrExtents = defineAsyncComponent(() => import('@/components/SrExtents.vue'))
const SrAncillaryFieldEditor = defineAsyncComponent(
  () => import('@/components/SrAncillaryFieldEditor.vue')
)
const SrSurfaceElevation = defineAsyncComponent(() => import('@/components/SrSurfaceElevation.vue'))
const SrGranuleSelection = defineAsyncComponent(() => import('@/components/SrGranuleSelection.vue'))
const SrGenUserPresets = defineAsyncComponent(() => import('@/components/SrGenUserPresets.vue'))
const SrGenUserOptions = defineAsyncComponent(() => import('@/components/SrGenUserOptions.vue'))
const SrVegDensity = defineAsyncComponent(() => import('@/components/SrVegDensity.vue'))
const SrGedi = defineAsyncComponent(() => import('@/components/SrGedi.vue'))
const SrRaster = defineAsyncComponent(() => import('@/components/SrRaster.vue'))
const SrAtl24Parms = defineAsyncComponent(() => import('@/components/SrAtl24Parms.vue'))
const SrAtl13Parms = defineAsyncComponent(() => import('@/components/SrAtl13Parms.vue'))
/* eslint-enable @typescript-eslint/promise-function-async */

interface Props {
  title: string
  ariaTitle: string
  mission: string
  iceSat2SelectedAPI: string
  gediSelectedAPI: string
}
const reqParamsStore = useReqParamsStore()
const props = defineProps<Props>()
const expandedPanels = ref<number[]>([])

const isPhotonProcessingAPI = computed(() => photonProcessingAPIs.has(props.iceSat2SelectedAPI))

// Fixed segment dimensions baked into pre-computed ATL06/ATL08 data products.
// Source: ICESat-2 ATL06 / ATL08 product specifications. atl06sp is the parallel
// ATL06 subsetter — same source segments as atl06x.
const fixedExtentsByAPI: Record<string, { len: number; res: number }> = {
  atl06sp: { len: 40, res: 20 },
  atl06x: { len: 40, res: 20 },
  atl08x: { len: 100, res: 100 }
}

const fixedExtents = computed(() => fixedExtentsByAPI[props.iceSat2SelectedAPI] ?? null)

const fixedExtentsTooltip = computed(() => {
  const api = props.iceSat2SelectedAPI
  return `Segment dimensions are fixed in the ${api} data product and cannot be modified.`
})

// Panels that show parameters used at request time are visible when the
// selected endpoint actually consumes them. Subsetter endpoints (atl06sp, atl06x,
// atl08x, atl24x, atl13x) read pre-computed segments from the source HDF5
// product so most photon-processing panels are hidden.
const showExtentsPanel = computed(() => isPhotonProcessingAPI.value || fixedExtents.value !== null)
const showSurfaceElevationPanel = computed(() =>
  ['atl06p', 'atl03x-surface'].includes(props.iceSat2SelectedAPI)
)
const showPhoRealPanel = computed(() =>
  ['atl08p', 'atl03x-phoreal'].includes(props.iceSat2SelectedAPI)
)

const onPanelOpen = (value: any) => {
  //console.log('onPanelOpen', value, "type: ", typeof value);
  expandedPanels.value.push(value.index)
}

const onPanelClose = (value: any) => {
  //console.log('onPanelClose', value, "type: ", typeof value);
  expandedPanels.value = expandedPanels.value.filter((p) => p !== value.index)
}

const isExpanded = (panelIndex: number) => {
  return expandedPanels.value.some((p) => p === panelIndex)
}
const fieldsHeader = computed(() => {
  return `${props.iceSat2SelectedAPI} Fields`
})
</script>

<template>
  <div class="adv-opt-card">
    <div class="adv-opts-wrapper">
      <Accordion
        class="sr-adv-accordian"
        :multiple="true"
        expandIcon="pi pi-plus"
        collapseIcon="pi pi-minus"
        @tab-open="onPanelOpen"
        @tab-close="onPanelClose"
      >
        <AccordionPanel value="0">
          <AccordionHeader>Presets</AccordionHeader>
          <AccordionContent v-if="isExpanded(0)">
            <SrGenUserPresets />
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="1">
          <AccordionHeader>General</AccordionHeader>
          <AccordionContent v-if="isExpanded(1)">
            <SrGenUserOptions />
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="2" v-if="mission === 'ICESat-2'">
          <AccordionHeader>Granule Selection</AccordionHeader>
          <AccordionContent v-if="isExpanded(2)">
            <SrGranuleSelection />
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="3" v-if="mission === 'ICESat-2' && isPhotonProcessingAPI">
          <AccordionHeader>Photon Selection</AccordionHeader>
          <AccordionContent v-if="isExpanded(3)">
            <SrAtl03Classification />
            <SrAtl08Cnf />
            <SrYAPC />
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="4" v-if="mission === 'ICESat-2' && showExtentsPanel">
          <AccordionHeader>Extents</AccordionHeader>
          <AccordionContent v-if="isExpanded(4)">
            <SrExtents v-if="isPhotonProcessingAPI" />
            <div
              v-else-if="fixedExtents"
              class="sr-fixed-extents"
              v-tooltip.top="fixedExtentsTooltip"
            >
              <div class="sr-fixed-extents-header">
                <i class="pi pi-lock"></i>
                <span>Fixed in {{ iceSat2SelectedAPI }} data product</span>
              </div>
              <div class="sr-fixed-extents-row">
                <span class="sr-fixed-extents-label">Length</span>
                <span class="sr-fixed-extents-value">{{ fixedExtents.len }} m</span>
              </div>
              <div class="sr-fixed-extents-row">
                <span class="sr-fixed-extents-label">Step Size</span>
                <span class="sr-fixed-extents-value">{{ fixedExtents.res }} m</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="5" v-if="mission === 'ICESat-2' && showSurfaceElevationPanel">
          <AccordionHeader>Surface Elevation</AccordionHeader>
          <AccordionContent v-if="isExpanded(5)">
            <SrSurfaceElevation />
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="6" v-if="mission === 'ICESat-2' && showPhoRealPanel">
          <AccordionHeader>PhoREAL Veg Density Alg</AccordionHeader>
          <AccordionContent v-if="isExpanded(6)">
            <SrVegDensity />
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel
          value="7"
          v-if="
            mission === 'ICESat-2' &&
            (props.iceSat2SelectedAPI.includes('atl24') ||
              props.iceSat2SelectedAPI.includes('atl13'))
          "
        >
          <AccordionHeader> {{ fieldsHeader }}</AccordionHeader>
          <AccordionContent v-if="isExpanded(7)">
            <SrAtl24Parms v-if="props.iceSat2SelectedAPI.includes('atl24')" />
            <SrAtl13Parms v-if="props.iceSat2SelectedAPI.includes('atl13')" />
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel
          value="8"
          v-if="
            mission === 'ICESat-2' &&
            (props.iceSat2SelectedAPI.includes('atl06') ||
              props.iceSat2SelectedAPI.includes('atl03') ||
              props.iceSat2SelectedAPI.includes('atl08') ||
              props.iceSat2SelectedAPI.includes('atl13'))
          "
        >
          <AccordionHeader>Ancillary Fields</AccordionHeader>
          <AccordionContent v-if="isExpanded(8)">
            <SrAncillaryFieldEditor
              v-if="props.iceSat2SelectedAPI.includes('atl03')"
              v-model="reqParamsStore.atl03_geo_fields"
              placeholder="Add Ancillary Field"
              label="atl03 Geo Fields"
            />
            <SrAncillaryFieldEditor
              v-if="props.iceSat2SelectedAPI.includes('atl03')"
              v-model="reqParamsStore.atl03_corr_fields"
              placeholder="Add Ancillary Field"
              label="atl03 Corr Fields"
            />
            <SrAncillaryFieldEditor
              v-if="props.iceSat2SelectedAPI.includes('atl03')"
              v-model="reqParamsStore.atl03_ph_fields"
              placeholder="Add Ancillary Field"
              label="atl03 Ph Fields"
            />
            <SrAncillaryFieldEditor
              v-if="props.iceSat2SelectedAPI.includes('atl06')"
              v-model="reqParamsStore.atl06_fields"
              placeholder="Add Ancillary Field"
              label="atl06 Fields"
            />
            <SrAncillaryFieldEditor
              v-if="props.iceSat2SelectedAPI.includes('atl08')"
              v-model="reqParamsStore.atl08_fields"
              placeholder="Add Ancillary Field"
              label="atl08 Fields"
            />
            <SrAncillaryFieldEditor
              v-if="props.iceSat2SelectedAPI.includes('atl13')"
              v-model="reqParamsStore.atl13_fields"
              placeholder="Add Ancillary Field"
              label="atl13 Fields"
            />
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="9" v-if="mission === 'GEDI'">
          <AccordionHeader>Ancillary Fields</AccordionHeader>
          <AccordionContent v-if="isExpanded(9)">
            <SrAncillaryFieldEditor
              v-model="reqParamsStore.gedi_fields"
              placeholder="Add Ancillary Field"
              label="Gedi Anc Fields"
            />
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="10" v-if="mission === 'GEDI'">
          <AccordionHeader>GEDI Footprint</AccordionHeader>
          <AccordionContent v-if="isExpanded(10)">
            <SrGedi />
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="11">
          <AccordionHeader>Raster Sampling</AccordionHeader>
          <AccordionContent v-if="isExpanded(11)">
            <SrRaster />
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </div>
  </div>
</template>

<style scoped>
.adv-opt-header {
  justify-content: center;
  align-items: center;
  margin-top: 0rem;
}

.adv-opt-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.adv-opts-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.sr-adv-accordian {
  width: 100%;
}

.sr-timeouts-fieldset {
  margin-top: 1rem;
}

.sr-color-palette {
  display: flex;
  flex-direction: column;
}

.sr-raster-sampling-table-section {
  border-radius: var(--p-border-radius);
  border: 2px solid var(--surface-d);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  margin: 0.125rem;
  padding: 0.125rem;
}
.sr-raster-sampling-table-head {
  display: flex;
  justify-content: center;
  align-items: center;
}
.sr-raster-sampling-table {
  flex: auto;
  width: 25rem;
  overflow-x: scroll;
  white-space: nowrap;
}

.sr-adv-opt-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: left;
}

.file-upload-panel {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0.5rem;
}
:deep(.p-progressbar-label) {
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

.summary,
.detail {
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

.sr-restore-timeout-defaults {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.sr-fixed-extents {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--p-surface-300);
  border-radius: var(--p-border-radius);
  cursor: help;
}

.sr-fixed-extents-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: small;
  color: var(--p-text-muted-color);
  margin-bottom: 0.25rem;
}

.sr-fixed-extents-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0.5rem;
  opacity: 0.7;
}

.sr-fixed-extents-label {
  font-size: large;
}

.sr-fixed-extents-value {
  font-family: monospace;
  font-size: large;
}
</style>
