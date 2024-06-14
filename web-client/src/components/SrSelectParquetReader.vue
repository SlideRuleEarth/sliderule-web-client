
<template>
    <div class="sr-reader-container">
        <SrMenuInput
            v-model="srParquetCfgStore.parquetReader"
            label = "Parquet Reader"
            aria-label="Select Parquet Reader"
            :menuOptions="srParquetCfgStore.parquetReaderOptions"
            tooltipText="Choose a Parquet Reader"
        />
    </div>
</template>

<script setup>
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import SrMenuInput from '@/components/SrMenuInput.vue';
import { onMounted } from 'vue';

const srParquetCfgStore = useSrParquetCfgStore();
  onMounted(() => {
    console.log('Mounted SrSelectParquetReader');
  });

</script>
<style scoped>
    .sr-reader-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between; 
        margin-top: 1rem;
        min-height: 30%;
        max-height: 30%;
        min-width: 30vw;
        width: 100%;
    }
</style>
