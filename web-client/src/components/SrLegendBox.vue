<template>
<div class="sr-legend-box">
    <h1 class="sr-legend-header">Elevation Legend</h1>
    <div class = "sr-legend-gradient-box">
    </div>
    <div class="sr-legend-minmax">
        <span class="sr-legend-min">{{ parseFloat(curReqSumStore.get_h_mean_Low().toFixed(1)) }}m</span>
        <span class="sr-legend-max">{{ parseFloat(curReqSumStore.get_h_mean_High().toFixed(1)) }}m</span>
    </div>
</div> 
</template>

<script setup lang="ts">
  import { onMounted } from 'vue'
  import { useCurReqSumStore } from '@/stores/curReqSumStore';

  const curReqSumStore = useCurReqSumStore();
  const emit = defineEmits(['legendbox-created', 'picked-changed']);
  
  onMounted(() => {
    console.log(`Mounted SrLegendBox`);
    emit('legendbox-created');
  });



</script>

<style scoped>

.sr-legend-box {
    color: var(--primary-color);
    padding: 0.3125rem;
    background: rgba(255, 255, 255, 0.25);
    border-radius: var(--border-radius);
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
}

.sr-legend-header {
    font-size: 1rem;
    margin: 0;
}

.sr-legend-gradient-box {
    background: linear-gradient(to right, purple,  yellow);
    height: 0.3125rem;
    width: 10rem;
    border-radius: var(--border-radius);
}

.sr-legend-minmax {
    display: flex;
    justify-content: space-between;
    width: 10rem;
}
.sr-legend-min {
    font-size: 0.75rem;
    padding-left: 0.25rem;
}

.sr-legend-max {
    font-size: 0.75rem;
    padding-right: 0.25rem;
}
</style>
