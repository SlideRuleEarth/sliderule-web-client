<template>
  <div class="sr-card">
    <div class="sr-card-header">Plot Config Defaults</div>
    <div class="sr-card-content">
      <div class="sr-form-grid">
        <!--
              <div class="sr-field">
                <label for="isLarge">Is Large</label>
                <ToggleButton v-model="plotConfigStore.isLarge" onLabel="Yes" offLabel="No" />
              </div>
            -->
        <!-- <div class="sr-field">
                <label for="largeThreshold">Large Threshold</label>
                <InputNumber v-model="plotConfigStore.largeThreshold" inputId="largeThreshold" :min="0" />
            </div> -->

        <div class="sr-field">
          <label for="progressiveChunkSize">Progressive Chunk Size</label>
          <InputNumber
            v-model="plotConfigStore.progressiveChunkSize"
            inputId="progressiveChunkSize"
            :min="1000"
            :max="100000"
            :step="1000"
            showButtons
          />
        </div>

        <div class="sr-field">
          <label for="progressiveChunkThreshold">Progressive Chunk Threshold</label>
          <InputNumber
            v-model="plotConfigStore.progressiveChunkThreshold"
            inputId="progressiveChunkThreshold"
            :min="1000"
            :max="100000"
            :step="1000"
            showButtons
          />
        </div>

        <div class="sr-field">
          <label for="progressiveChunkMode">Progressive Chunk Mode</label>
          <Select
            v-model="plotConfigStore.progressiveChunkMode"
            :options="chunkModes"
            optionLabel="label"
            optionValue="value"
          />
        </div>

        <div class="sr-field">
          <label for="defaultAtl06Color">Default ATL06 Color</label>
          <InputText v-model="plotConfigStore.defaultAtl06Color" inputId="defaultAtl06Color" />
        </div>

        <div class="sr-field" v-for="api in symbolSizeApis" :key="api">
          <label :for="`symbolSize-${api}`">{{ api.toUpperCase() }} Symbol Size</label>
          <InputNumber
            v-model="plotConfigStore.defaultSymbolSize[api]"
            :inputId="`symbolSize-${api}`"
            :min="1"
            :max="20"
            :step="1"
            showButtons
          />
        </div>

        <div class="sr-field">
          <label for="defaultGradientColorMapName">Gradient Color Map</label>
          <Select
            v-model="plotConfigStore.defaultGradientColorMapName"
            :options="colorMapOptions"
            optionLabel="name"
            optionValue="value"
            inputId="defaultGradientColorMapName"
          />
        </div>

        <div class="sr-field">
          <label for="defaultGradientNumShades">Gradient Num Shades</label>
          <InputNumber
            v-model="plotConfigStore.defaultGradientNumShades"
            inputId="defaultGradientNumShades"
            :min="16"
            :max="1024"
            :step="16"
            showButtons
          />
        </div>
      </div>
    </div>
    <div class="sr-card-footer">
      <div class="sr-card-footer-left-side">
        <Button
          label="Defaults"
          icon="pi pi-refresh"
          @click="handleRestoreDefaults"
          size="small"
          class="sr-button-secondary"
        />
      </div>
      <div class="sr-card-footer-right-side">
        <span class="auto-save-hint">Changes are saved automatically</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { usePlotConfigStore } from '@/stores/plotConfigStore'
import { getColorMapOptions } from '@/utils/colorUtils'

const plotConfigStore = usePlotConfigStore()

const chunkModes = ref([
  { label: 'Auto', value: 'auto' },
  { label: 'Sequential', value: 'sequential' },
  { label: 'Mod', value: 'mod' }
])

const colorMapOptions = getColorMapOptions()

const symbolSizeApis = computed(() => Object.keys(plotConfigStore.defaultSymbolSize))

const handleRestoreDefaults = () => {
  plotConfigStore.restoreDefaults()
}
</script>

<style scoped>
.sr-card {
  border: 2px solid grey;
  border-radius: 0.5rem;
  padding: 1rem;
}

.sr-card-header {
  display: flex;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.sr-card-content {
  margin-bottom: 1rem;
}

.sr-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.sr-field {
  display: flex;
  flex-direction: column;
}

.sr-card-footer-left-side {
  display: flex;
  justify-content: flex-start;
  gap: 1rem;
}
.sr-card-footer-right-side {
  display: flex;
  justify-content: flex-end;
  gap: 0.25rem;
}

.sr-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.auto-save-hint {
  font-size: 0.85rem;
  color: #888;
  font-style: italic;
}
</style>
