<template>
  <div class="sr-beam-panel">
    <div class="checkbox-container">
      <Panel header="Spots/Beams" :toggleable="true" :collapsed="false">
        <div class="sr-spots-panel">
          <div class="sr-spots-panel-hdr">
            <div class="checkbox-col">
              <div class="checkbox-item">
                <SrSpotCheckbox
                  v-model="globalChartStore.selectedSpots"
                  :digit="0"
                  label="Beam0000 coverage"
                  :tooltipText="Beam0000_tooltip"
                  @user-checked="onUserToggled"
                />
              </div>
              <div class="checkbox-item">
                <SrSpotCheckbox
                  v-model="globalChartStore.selectedSpots"
                  :digit="1"
                  label="Beam0001 coverage"
                  :tooltipText="Beam0001_tooltip"
                  @user-checked="onUserToggled"
                />
              </div>
              <div class="checkbox-item">
                <SrSpotCheckbox
                  v-model="globalChartStore.selectedSpots"
                  :digit="2"
                  label="Beam0010 coverage"
                  :tooltipText="Beam0010_tooltip"
                  @user-checked="onUserToggled"
                />
              </div>
              <div class="checkbox-item">
                <SrSpotCheckbox
                  v-model="globalChartStore.selectedSpots"
                  :digit="3"
                  label="Beam0011 coverage"
                  :tooltipText="Beam0011_tooltip"
                  @user-checked="onUserToggled"
                />
              </div>
              <div class="checkbox-item">
                <SrSpotCheckbox
                  v-model="globalChartStore.selectedSpots"
                  :digit="4"
                  label="Beam0100 coverage"
                  :tooltipText="Beam0100_tooltip"
                  @user-checked="onUserToggled"
                />
              </div>
              <div class="checkbox-item">
                <SrSpotCheckbox
                  v-model="globalChartStore.selectedSpots"
                  :digit="5"
                  label="Beam0101 Full Power"
                  :tooltipText="Beam0101_tooltip"
                  @user-checked="onUserToggled"
                />
              </div>
              <div class="checkbox-item">
                <SrSpotCheckbox
                  v-model="globalChartStore.selectedSpots"
                  :digit="6"
                  label="Beam0110 Full Power"
                  :tooltipText="Beam0110_tooltip"
                  @user-checked="onUserToggled"
                />
              </div>
              <div class="checkbox-item">
                <SrSpotCheckbox
                  v-model="globalChartStore.selectedSpots"
                  :digit="8"
                  label="Beam1000 Full Power"
                  :tooltipText="Beam1000_tooltip"
                  @user-checked="onUserToggled"
                />
              </div>
              <div class="checkbox-item">
                <SrSpotCheckbox
                  v-model="globalChartStore.selectedSpots"
                  :digit="11"
                  label="Beam1011 Full Power"
                  :tooltipText="Beam1011_tooltip"
                  @user-checked="onUserToggled"
                />
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  </div>
</template>

<script setup lang="ts">
import Panel from 'primevue/panel'
import SrSpotCheckbox from '@/components/SrSpotCheckbox.vue'
import { watch, nextTick } from 'vue'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import { callPlotUpdateDebounced } from '@/utils/plotUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrBeamPatternGedi')

const globalChartStore = useGlobalChartStore()

const Beam0000_tooltip = `Beam 0000 Coverage`
const Beam0001_tooltip = `Beam 0001 Coverage`
const Beam0010_tooltip = `Beam 0010 Coverage`
const Beam0011_tooltip = `Beam 0011 Coverage`
const Beam0100_tooltip = `Beam 0100 Full Power`
const Beam0101_tooltip = `Beam 0101 Full Power`
const Beam0110_tooltip = `Beam 0110 Full Power`
const Beam1000_tooltip = `Beam 1000 Full Power`
const Beam1011_tooltip = `Beam 1011 Full Power`
// Define props with TypeScript types
withDefaults(
  defineProps<{
    reqIdStr: string
  }>(),
  {
    reqIdStr: '0'
  }
)

const handleValueChange = (_e: any) => {
  //console.log('handleValueChange', e);
  //console.log('handleValueChange BEFORE globalChartStore.selectedSpots:',globalChartStore.selectedSpots, 'globalChartStore.getScOrients:', globalChartStore.getScOrients(), 'globalChartStore.hasScForward:', globalChartStore.hasScForward, 'globalChartStore.hasScBackward:', globalChartStore.hasScBackward, 'globalChartStore.gts:', globalChartStore.getGts(), 'globalChartStore.tracks:', globalChartStore.getTracks(), 'globalChartStore.pairs:', globalChartStore.getPairs());
  const currentTracks = [] as number[]

  globalChartStore.setTracks(currentTracks)
  //console.log('handleValueChange AFTER  globalChartStore.selectedSpots:',globalChartStore.selectedSpots, 'globalChartStore.getScOrients:', globalChartStore.getScOrients(), 'globalChartStore.hasScForward:', globalChartStore.hasScForward, 'globalChartStore.hasScBackward:', globalChartStore.hasScBackward, 'globalChartStore.gts:', globalChartStore.getGts(), 'globalChartStore.tracks:', globalChartStore.getTracks(), 'globalChartStore.pairs:', globalChartStore.getPairs());
}

// These watchers trigger for both user and programatic changes and are used to update the selected spots and tracks
watch(() => globalChartStore.selectedSpots, handleValueChange)

/**
 * This method is called whenever SrSpotCheckbox emits `user-toggled`.
 * We wrap `callPlotUpdateDebounced` in `nextTick` so that the watchers
 * have already finished for this update cycle.
 */
function onUserToggled(_digit: number) {
  logger.debug('onUserToggled spot digit', { digit: _digit })
  void nextTick(async () => {
    await callPlotUpdateDebounced('SrBeamPattern')
  })
}
</script>

<style scoped>
.sr-beam-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: 0.25rem;
  padding: 0.25rem;
  width: auto;
  white-space: nowrap; /* Prevents text from wrapping */
  overflow: hidden; /* Hides overflow */
  text-overflow: ellipsis; /* Adds an ellipsis if the text overflows */
}

.checkbox-container {
  padding: 0rem;
  margin: 0.125rem;
}

.checkbox-col {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  font-size: smaller;
  margin-top: 0.125rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  justify-content: center;
  row-gap: 0.5rem;
  column-gap: 0.25rem;
}
.sr-spots-panel {
  margin-bottom: 0.125rem;
}
.sr-spots-panel-hdr {
  padding: 0.125rem;
}
.sr-spots-panel-hdr {
  padding-top: 0rem;
  padding-bottom: 0rem;
  padding-left: 0.125rem;
  padding-right: 0.125rem;
}
.sr-spots-backward-panel {
  padding-top: 0rem;
  padding-bottom: 0rem;
  padding-left: 0.125rem;
  padding-right: 0.125rem;
  margin-top: 0rem;
}
.sr-spots-backward-panel-hdr {
  padding-top: 0rem;
  padding-bottom: 0.5rem;
  padding-left: 0.125rem;
  padding-right: 0.125rem;
}
.sr-p {
  margin: 0.25rem;
  font-size: small;
  color: var(--color-text);
}
.sr-spots-title {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.25rem;
  font-size: small;
  border-bottom: 1px solid var(--color-border);
}
.sr-sc-orient-panel {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  font-size: smaller;
  margin-top: 0.125rem;
  margin-bottom: 0.125rem;
}
/* :deep(.p-panel-content) {
    padding: 0.125rem;
    margin: 0.125rem;
} */
:deep(.p-divider-horizontal) {
  margin-top: 1rem;
  margin-bottom: 0.25rem;
  padding: 0.125rem;
}

:deep(.p-checkbox.p-checkbox-sm) .p-checkbox-box {
  display: flex;
  /* width: 1rem;
    height: 1rem; */
  align-items: center;
  justify-content: center;
}
</style>
