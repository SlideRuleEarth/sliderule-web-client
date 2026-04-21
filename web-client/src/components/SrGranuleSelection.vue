<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import Fieldset from 'primevue/fieldset'
import SrCalendar from './SrCalendar.vue'
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue'
import SrCheckbox from './SrCheckbox.vue'
import SrListbox from './SrListbox.vue'
import {
  tracksOptions as _tracksOptions,
  gtsOptions,
  getGtsAndTracksWithGts
} from '@/utils/parmUtils'
import { type SrListNumberItem } from '@/types/SrTypes'
import { createLogger } from '@/utils/logger'
import { DOCS } from '@/utils/docLinks'

const logger = createLogger('SrGranuleSelection')
const reqParamsStore = useReqParamsStore()
const defaultEnableGranuleSelection = () => {
  return reqParamsStore.enableGranuleSelection !== undefined
    ? reqParamsStore.enableGranuleSelection
    : false
}
const defaultRgt = () => {
  return reqParamsStore.rgtValue !== undefined ? reqParamsStore.rgtValue : 0
}
const defaultCycle = () => {
  return reqParamsStore.cycleValue !== undefined ? reqParamsStore.cycleValue : 0
}
const defaultRegion = () => {
  return reqParamsStore.regionValue !== undefined ? reqParamsStore.regionValue : 0
}
const defaultUseTime = () => {
  return reqParamsStore.useTime !== undefined ? reqParamsStore.useTime : false
}
const defaultT0 = () => {
  return reqParamsStore.t0Value !== undefined ? reqParamsStore.t0Value : null
}
const defaultT1 = () => {
  return reqParamsStore.t1Value !== undefined ? reqParamsStore.t1Value : null
}
const ccvRgt = () => {
  return reqParamsStore.getUseRgt() !== undefined ? reqParamsStore.getUseRgt() : false
}
const ccvCycle = () => {
  return reqParamsStore.getUseCycle() !== undefined ? reqParamsStore.getUseCycle() : false
}
const ccvRegion = () => {
  return reqParamsStore.getUseRegion() !== undefined ? reqParamsStore.getUseRegion() : false
}
const defaultMaxResources = () => {
  return reqParamsStore.maxResourcesValue !== undefined ? reqParamsStore.maxResourcesValue : 300
}
const ccvMaxResources = () => {
  return reqParamsStore.getUseMaxResources() !== undefined
    ? reqParamsStore.getUseMaxResources()
    : false
}

onMounted(() => {
  //console.log('Mounted SrGranuleSelection');
})

onUnmounted(() => {
  //console.log('Unmounted SrGranuleSelection');
})

const GtsSelection = (gts: SrListNumberItem[]) => {
  logger.debug('GtsSelection', { gts })
  const parms = getGtsAndTracksWithGts(gts)
  reqParamsStore.setSelectedTrackOptions(parms.tracks)
  logger.debug('GtsSelection result', {
    gts,
    tracks: reqParamsStore.tracks,
    beams: reqParamsStore.beams
  })
}
</script>

<template>
  <div class="sr-granule-selection-container">
    <div class="sr-granule-selection-header">
      <SrCheckbox
        v-model="reqParamsStore.enableGranuleSelection"
        :getCheckboxValue="reqParamsStore.getEnableGranuleSelection"
        :setCheckboxValue="reqParamsStore.setEnableGranuleSelection"
        :defaultValue="defaultEnableGranuleSelection()"
        label="Granule Selection"
        labelFontSize="large"
        tooltipText="A granule is a single file of NASA Earth science data produced by a mission's Science Investigator-led Processing System (SIPS) and cataloged in NASA's Common Metadata Repository (CMR). For the satellite altimetry missions SlideRule processes (ICESat-2, GEDI), a granule corresponds to one continuous segment of observation from the instrument — typically a fraction of an orbit — stored as an HDF5 file in cloud object storage (e.g. the NSIDC Cumulus S3 bucket). Granule filenames encode the data product, acquisition time, and orbital/version identifiers, for example ATL03_20181019065445_03150111_007_01.h5 (ATL03 product, acquired 2018-10-19 06:54:45 UTC, Reference Ground Track 0315, cycle 01, region 11, release 007, revision 01).
In SlideRule, granules are the physical objects behind the more general concept of a resource. When a processing request is issued, SlideRule either (a) uses a list of granule filenames supplied directly by the user via the resources parameter, or (b) resolves the relevant granules itself by querying CMR — or, for ATL13, SlideRule's own Asset Metadata Service — using the request's area of interest, time range, and other filters. The selected granules are then read in parallel from cloud storage via H5Coro and subset server-side."
      />
    </div>
    <div class="sr-granule-tracks-beams-div">
      <SrListbox
        id="beams"
        :insensitive="!reqParamsStore.enableGranuleSelection"
        label="Beam(s)"
        v-model="reqParamsStore.beams"
        :defaultValue="reqParamsStore.beams"
        :getSelectedMenuItem="reqParamsStore.getSelectedGtOptions"
        :setSelectedMenuItem="reqParamsStore.setSelectedGtOptions"
        :menuOptions="gtsOptions"
        tooltipText="ATLAS laser beams are divided into three tracks of weak and strong beams"
        :tooltipUrl="DOCS.icesat2.photonInput"
        @update:modelValue="GtsSelection"
      />
    </div>
    <SrSwitchedSliderInput
      :insensitive="!reqParamsStore.enableGranuleSelection"
      v-model="reqParamsStore.rgtValue"
      :getCheckboxValue="reqParamsStore.getUseRgt"
      :setCheckboxValue="reqParamsStore.setUseRgt"
      :getValue="reqParamsStore.getRgt"
      :setValue="reqParamsStore.setRgt"
      :defaultValue="defaultRgt()"
      :currentCheckboxValue="ccvRgt()"
      label="RGT"
      :min="1"
      :max="1388"
      :decimalPlaces="0"
      tooltipText="RGT is the reference ground track: defaults to all if not specified"
      :tooltipUrl="DOCS.icesat2.photonInput"
    />
    <SrSwitchedSliderInput
      :insensitive="!reqParamsStore.enableGranuleSelection"
      v-model="reqParamsStore.cycleValue"
      :getCheckboxValue="reqParamsStore.getUseCycle"
      :setCheckboxValue="reqParamsStore.setUseCycle"
      :getValue="reqParamsStore.getCycle"
      :setValue="reqParamsStore.setCycle"
      :defaultValue="defaultCycle()"
      :currentCheckboxValue="ccvCycle()"
      label="Cycle"
      :min="1"
      :max="100"
      :decimalPlaces="0"
      tooltipText="counter of 91-day repeat cycles completed by the mission (defaults to all if not specified)"
      :tooltipUrl="DOCS.icesat2.photonInput"
    />
    <SrSwitchedSliderInput
      :insensitive="!reqParamsStore.enableGranuleSelection"
      v-model="reqParamsStore.regionValue"
      :getCheckboxValue="reqParamsStore.getUseRegion"
      :setCheckboxValue="reqParamsStore.setUseRegion"
      :getValue="reqParamsStore.getRegion"
      :setValue="reqParamsStore.setRegion"
      :defaultValue="defaultRegion()"
      :currentCheckboxValue="ccvRegion()"
      label="Atl03 Granule Region"
      :min="1"
      :max="14"
      :decimalPlaces="0"
      tooltipText="atl03 granule region (zero means all), See section 2.5 pages 14-17 of the 'Algorithm Theoretical Basis Document'"
      :tooltipUrl="DOCS.icesat2.photonInput"
    />
    <SrSwitchedSliderInput
      :insensitive="!reqParamsStore.enableGranuleSelection"
      v-model="reqParamsStore.maxResourcesValue"
      :getCheckboxValue="reqParamsStore.getUseMaxResources"
      :setCheckboxValue="reqParamsStore.setUseMaxResources"
      :getValue="reqParamsStore.getMaxResources"
      :setValue="reqParamsStore.setMaxResources"
      :defaultValue="defaultMaxResources()"
      :currentCheckboxValue="ccvMaxResources()"
      label="Max Resources"
      :min="0"
      :max="1000"
      :decimalPlaces="0"
      tooltipText="Maximum number of resources (e.g. granules, tiles, etc.) that can be processed by a single request."
      :tooltipUrl="DOCS.icesat2.photonInput"
    />
    <Fieldset
      legend="Time Range"
      class="sr-time-range-content"
      :toggleable="true"
      :collapsed="false"
    >
      <SrCheckbox
        :insensitive="!reqParamsStore.enableGranuleSelection"
        v-model="reqParamsStore.useTime"
        :getCheckboxValue="reqParamsStore.getUseTime"
        :setCheckboxValue="reqParamsStore.setUseTime"
        :defaultValue="defaultUseTime()"
        label="Use Time Filter"
        labelFontSize="large"
        tooltipText="Filter granules by time"
        :tooltipUrl="DOCS.icesat2.photonInput"
      />
      <SrCalendar
        :insensitive="!(reqParamsStore.enableGranuleSelection && reqParamsStore.useTime)"
        v-model="reqParamsStore.t0Value"
        label="T0"
        :getValue="reqParamsStore.getT0"
        :setValue="reqParamsStore.setT0"
        :defaultValue="defaultT0()"
        tooltipText="Start Time for filtering granules"
        :tooltipUrl="DOCS.icesat2.photonInput"
      />
      <SrCalendar
        :insensitive="!(reqParamsStore.enableGranuleSelection && reqParamsStore.useTime)"
        v-model="reqParamsStore.t1Value"
        label="T1"
        :getValue="reqParamsStore.getT1"
        :setValue="reqParamsStore.setT1"
        :defaultValue="defaultT1()"
        tooltipText="End Time for filtering granules"
        :tooltipUrl="DOCS.icesat2.photonInput"
      />
    </Fieldset>
  </div>
</template>

<style scoped>
.sr-granule-selection-container {
  padding: 0.75rem;
  border: 1px solid grey;
  border-radius: var(--p-border-radius);
}
.sr-granule-selection-header {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: transparent;
  margin-bottom: 1rem;
}
.sr-granule-tracks-beams-div {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 1rem;
}
.sr-granule-tracks-div {
  margin-right: 1rem;
}
.sr-granule-beams-div {
  margin-left: 1rem;
}
:deep(.p-listbox-option) {
  padding-top: 0.125rem;
  padding-bottom: 0rem;
}
</style>
