<template>
  <div class="deck-config-panel">
    <SrCustomTooltip ref="tooltipRef" id="threeDTooltip" />
    <div class="config-row">
      <section class="config-section">
        <h4>View Control</h4>
        <div class="config-item">
          <label for="fovy">Field of View (°)</label>
          <InputNumber
            v-model="store.fovy"
            :min="1"
            :max="180"
            size="small"
            id="fovy"
            @input="handleChange"
          />
        </div>
        <div class="config-item">
          <label for="colormax">Color Grad Max %</label>
          <InputNumber
            v-model="store.maxColorPercent"
            :min="1"
            :max="100"
            size="small"
            id="colormax"
            :showButtons="true"
            @input="handleChange"
          />
        </div>
        <div class="config-item">
          <label for="colormin">Color Grad Min %</label>
          <InputNumber
            v-model="store.minColorPercent"
            :min="0"
            :max="store.maxColorPercent"
            size="small"
            id="colormin"
            :showButtons="true"
            @input="handleChange"
          />
        </div>
        <div class="config-item">
          <label for="colormax">Data Scale Max %</label>
          <InputNumber
            v-model="store.elScaleRange[1]"
            :min="1"
            :max="100"
            size="small"
            id="colormax"
            :showButtons="true"
            @input="handleChange"
          />
        </div>
        <div class="config-item">
          <label for="colormin">Data Scale Min %</label>
          <InputNumber
            v-model="store.elScaleRange[0]"
            :min="0"
            :max="store.elScaleRange[1]"
            size="small"
            id="colormin"
            :showButtons="true"
            @input="handleChange"
          />
        </div>
        <div class="config-item" v-if="globalChartStore.enableLocationFinder">
          <label for="markerScale">Hover Marker %</label>
          <InputNumber
            v-model="store.hoverMarkerScale"
            :min="0.5"
            :max="20"
            :step="0.5"
            :minFractionDigits="1"
            :maxFractionDigits="1"
            size="small"
            id="markerScale"
            :showButtons="true"
            @input="handleChange"
          />
        </div>
        <div class="config-item-centered">
          <Button
            label="Update View"
            icon="pi pi-refresh"
            class="sr-glow-button"
            variant="text"
            rounded
            @click="handleChange"
          />
        </div>
      </section>
      <section class="config-section">
        <h4>Live View State</h4>
        <div class="config-item">
          <label for="liveZoom">Zoom</label>
          <InputNumber
            v-model="store.viewState.zoom"
            :min="0"
            :max="20"
            id="liveZoom"
            :disabled="true"
            size="small"
          />
        </div>
        <div class="config-item">
          <label for="liveRotX">Rotation X (°)</label>
          <InputNumber
            v-model="store.viewState.rotationX"
            :min="0"
            :max="90"
            id="liveRotX"
            :disabled="true"
            size="small"
          />
        </div>
        <div class="config-item">
          <label for="liveRotO">Rotation Orbit (°)</label>
          <InputNumber
            v-model="store.viewState.rotationOrbit"
            :min="0"
            :max="360"
            id="liveRotO"
            :disabled="true"
            size="small"
          />
        </div>
        <div class="config-item">
          <label>Target</label>
          <div class="centroid-inputs">
            <InputNumber
              v-for="(_c, i) in store.viewState.target"
              :key="i"
              v-model="store.viewState.target[i]"
              :disabled="true"
              class="centroid-num"
              size="small"
            />
          </div>
        </div>
        <div class="config-item">
          <label class="sr-vert-scl-label" for="vertSclId">Vertical Scale Ratio</label>
          <InputNumber
            v-model="deck3DConfigStore.verticalScaleRatio"
            :disabled="true"
            inputId="vertSclId"
            size="small"
            :defaultValue="deck3DConfigStore.verticalScaleRatio"
            :decimalPlaces="4"
            @mouseover="
              tooltipRef.showTooltip(
                $event,
                'Vertical Scale Ratio: The ratio of vertical scale to horizontal scale in the 3D view. This affects how elevation data is visualized. Use this value for Vertical Exaggeration to fill the cube in the 3D view.'
              )
            "
            @mouseleave="tooltipRef.hideTooltip()"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDeck3DConfigStore } from '@/stores/deck3DConfigStore'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import InputNumber from 'primevue/inputnumber'
import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { loadAndCachePointCloudData } from '@/utils/deck3DPlotUtils'
import { debouncedRender } from '@/utils/SrDebounce'
import Button from 'primevue/button'
import { storeToRefs } from 'pinia'

const recTreeStore = useRecTreeStore()
const deck3DConfigStore = useDeck3DConfigStore()
const globalChartStore = useGlobalChartStore()
const { deckContainer } = storeToRefs(deck3DConfigStore)
const reqId = computed(() => recTreeStore.selectedReqId)
const tooltipRef = ref()
const store = useDeck3DConfigStore()

async function handleChange() {
  await loadAndCachePointCloudData(reqId.value)
  debouncedRender(deckContainer)
}
</script>

<style scoped>
.deck-config-panel {
  padding: 1rem;
  background-color: var(--surface-b);
  border-radius: 0.5rem;
}

.config-section {
  flex: 1;
  margin-bottom: 1.5rem;
}

.config-section h4 {
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.config-row {
  display: flex;
  flex-direction: row;
  gap: 2rem; /* space between the two sections */
}

.config-item {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
}
.config-item-centered {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.config-item label {
  width: 150px;
  margin-right: 0.5rem;
  font-weight: 500;
}

.centroid-inputs {
  display: flex;
  gap: 0.5rem;
}

.centroid-num {
  width: 80px;
}

/* Override PrimeVue component widths */
:deep(.p-inputnumber-input) {
  width: 6rem;
}

:deep(.p-slider) {
  flex: 1;
}

.config-section h4 {
  margin-bottom: 0.75rem;
  font-size: 1.1rem;
  text-align: center;
}
</style>
