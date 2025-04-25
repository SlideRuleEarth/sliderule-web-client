<template>
    <div class="deck-config-panel">
      <SrCustomTooltip/>
      <div class="config-row">
        <section class="config-section">
          <h4>View Control</h4>
          <div class="config-item">
            <label for="scale">Scale</label>
            <InputNumber v-model="store.scale" :min="1" :max="1000" size="small" id="scale"/>
          </div>        
          <div class="config-item">
            <label for="fovy">Field of View (°)</label>
            <InputNumber v-model="store.fovy" :min="1" :max="180" size="small" id="fovy"/>
          </div>
          <div class="config-item">
            <label for="orbitAxis">Orbit Axis</label>
            <Select
              v-model="store.orbitAxis"
              :options="orbitAxisOptions"
              optionLabel="label"
              optionValue="value"
              id="orbitAxis"
              size="small"
            />
          </div>
        </section>
        <section class="config-section">
          <h4>Live View State</h4>
          <div class="config-item">
            <label for="liveZoom">Zoom</label>
            <InputNumber
              v-model="store.viewState.zoom"
              :min="0" :max="20"
              id="liveZoom"
              :disabled="true"
              size="small" 
            />
          </div>
          <div class="config-item">
            <label for="liveRotX">Rotation X (°)</label>
            <InputNumber
              v-model="store.viewState.rotationX"
              :min="0" :max="90"
              id="liveRotX"
              :disabled="true"
              size="small" 
            />
          </div>
          <div class="config-item">
            <label for="liveRotO">Rotation Orbit (°)</label>
            <InputNumber
              v-model="store.viewState.rotationOrbit"
              :min="0" :max="360"
              id="liveRotO"
              :disabled="true"
              size="small" 
            />
          </div>
          <div class="config-item">
            <label>Target</label>
            <div class="centroid-inputs">
              <InputNumber
                v-for="(c, i) in store.viewState.target"
                :key="i"
                v-model="store.viewState.target[i]"
                :disabled="true"
                class="centroid-num"
                size="small" 
              />
            </div>
          </div>
        </section>
      </div>
    </div>
</template>
  
<script setup lang="ts">
  import { computed } from 'vue'
  import { useDeck3DConfigStore } from '@/stores/deck3DConfigStore'
  import InputNumber from 'primevue/inputnumber'
  import Select from 'primevue/select'
  import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
  
  const store = useDeck3DConfigStore()
  
  const orbitAxisOptions = computed(() => [
    { label: 'Z Axis', value: 'Z' },
    { label: 'Y Axis', value: 'Y' }
  ])
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
  