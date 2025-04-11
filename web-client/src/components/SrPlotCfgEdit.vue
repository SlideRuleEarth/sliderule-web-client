<template>
    <div class="sr-card">
        <div class="sr-card-header">Plot Config Defaults</div>
        <div class="sr-card-content">
            <div class="sr-form-grid" v-if="plotConfig">
            <!-- 
              <div class="sr-field">
                <label for="isLarge">Is Large</label>
                <ToggleButton v-model="plotConfig.isLarge" onLabel="Yes" offLabel="No" />
              </div>
            -->
            <!-- <div class="sr-field">
                <label for="largeThreshold">Large Threshold</label>
                <InputNumber v-model="plotConfig.largeThreshold" inputId="largeThreshold" :min="0" />
            </div> -->
    
            <div class="sr-field">
                <label for="progressiveChunkSize">Progressive Chunk Size</label>
                <InputNumber v-model="plotConfig.progressiveChunkSize" inputId="progressiveChunkSize" :min="0" />
            </div>
    
            <div class="sr-field">
                <label for="progressiveChunkThreshold">Progressive Chunk Threshold</label>
                <InputNumber v-model="plotConfig.progressiveChunkThreshold" inputId="progressiveChunkThreshold" :min="0" />
            </div>
    
            <div class="sr-field">
                <label for="progressiveChunkMode">Progressive Chunk Mode</label>
                <Select v-model="plotConfig.progressiveChunkMode" :options="chunkModes" optionLabel="label" optionValue="value" />
            </div>
    
            <div class="sr-field">
                <label for="defaultAtl06Color">Default ATL06 Color</label>
                <InputText v-model="plotConfig.defaultAtl06Color" inputId="defaultAtl06Color" />
            </div>
    
            <div class="sr-field">
                <label for="defaultAtl06SymbolSize">Default ATL06 Symbol Size</label>
                <InputNumber v-model="plotConfig.defaultAtl06SymbolSize" inputId="defaultAtl06SymbolSize" :min="0" />
            </div>
    
            <div class="sr-field">
                <label for="defaultAtl08SymbolSize">Default ATL08 Symbol Size</label>
                <InputNumber v-model="plotConfig.defaultAtl08SymbolSize" inputId="defaultAtl08SymbolSize" :min="0" />
            </div>
    
            <div class="sr-field">
                <label for="defaultAtl03spSymbolSize">Default ATL03 SP Symbol Size</label>
                <InputNumber v-model="plotConfig.defaultAtl03spSymbolSize" inputId="defaultAtl03spSymbolSize" :min="0" />
            </div>
    
            <div class="sr-field">
                <label for="defaultAtl03vpSymbolSize">Default ATL03 VP Symbol Size</label>
                <InputNumber v-model="plotConfig.defaultAtl03vpSymbolSize" inputId="defaultAtl03vpSymbolSize" :min="0" />
            </div>
    
            <div class="sr-field">
                <label for="defaultGradientColorMapName">Gradient Color Map</label>
                <InputText v-model="plotConfig.defaultGradientColorMapName" inputId="defaultGradientColorMapName" />
            </div>
    
            <div class="sr-field">
                <label for="defaultGradientNumShades">Gradient Num Shades</label>
                <InputNumber v-model="plotConfig.defaultGradientNumShades" inputId="defaultGradientNumShades" :min="0" />
            </div>
            </div>
        </div>
        <div class="sr-card-footer">
          <div class="sr-card-footer-left-side" v-if="plotConfig">
              <Button label="Defaults" icon="pi pi-refresh" @click="restoreDefaults" size="small" class="sr-button-secondary" />
          </div>
          <div class="sr-card-footer-right-side" v-if="plotConfig">
              <Button label="Save" icon="pi pi-save" @click="saveConfig" size="small"  class="sr-button-primary" />
              <Button label="Cancel" icon="pi pi-times" size="small" class="sr-button-secondary" @click="handleCancel" />
          </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import InputNumber from 'primevue/inputnumber';
  import InputText from 'primevue/inputtext';
  import Select from 'primevue/select';
  import Button from 'primevue/button';
  import { db } from '@/db/SlideRuleDb';
  import type { SrPlotConfig } from '@/db/SlideRuleDb';
  
  const plotConfig = ref<SrPlotConfig | null>(null);
  const chunkModes = ref([
    { label: 'Auto', value: 'auto' },
    { label: 'Manual', value: 'manual' },
    { label: 'None', value: 'none' }
  ]);
  
  const fetchPlotConfig = async () => {
    const config = await db.getPlotConfig();
    if (config) {
      plotConfig.value = { ...config };
    }
  };
  
  const saveConfig = async () => {
    if (plotConfig.value) {
      await db.updatePlotConfig(plotConfig.value);
      alert('PlotConfig saved successfully!');
    }
  };
  
  const restoreDefaults = async () => {
    await db.restorePlotConfig();
    await fetchPlotConfig();
    alert('PlotConfig restored to defaults!');
  }
  
  const handleCancel = async () => {
    await fetchPlotConfig();
  };

  onMounted(fetchPlotConfig);
</script>

<style scoped>
  .sr-card {
    border: 2px solid grey;
    border-radius: 0.5rem;
    padding: 1.0rem;
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
  }

</style>
  