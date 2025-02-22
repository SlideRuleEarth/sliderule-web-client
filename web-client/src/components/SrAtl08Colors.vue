<template>
    <div class="sr-legend-box">
        <Fieldset
            class="sr-lb-fieldset"
            legend="ATL08 Class Colors"
            :toggleable="false"
            :collapsed="false" 
        >
            <div  v-for="option in atl08ClassOptions"  :key="option.value" class="legend-item" >
                <div  class="color-box"  :style="{ backgroundColor: atl08ClassColorMapStore.getColorForAtl08ClassValue(option.value) }" ></div>
                <div class="label"> {{ formatLabel(option.label) }} ({{ option.value }}) </div>
            </div>
        </Fieldset>
    </div>
</template>
  
<script setup lang="ts">

import { onMounted, computed, ref } from 'vue';
import { useAtl08ClassColorMapStore } from '@/stores/atl08ClassColorMapStore';
import Fieldset from 'primevue/fieldset';

const emit = defineEmits(['restore-atl08-color-defaults-click', 'atl08ClassColorChanged']);
const props = defineProps({
    reqIdStr: {
        type: String,
        required: true
    }
});
const atl08ClassColorMapStore = ref<any>(null);

onMounted(async () => {
    atl08ClassColorMapStore.value = await useAtl08ClassColorMapStore(props.reqIdStr);
});

const atl08ClassOptions = computed(() => atl08ClassColorMapStore.value?.atl08ClassOptions);


// Function to format the label
const formatLabel = (label: string): string => {
  return label.replace(/^atl08_/, '').replace(/_/g, ' ');
};


</script>
  
  <style scoped>
  .sr-legend-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: var(--p-primary-color);
    border-radius: var(--p-border-radius);
    border: 1px solid transparent; /* Initially transparent */
    transition: border 0.3s ease-in-out; /* Smooth transition effect */
    min-width: 10rem;
  }
  
  .sr-legend-box:hover {
    border: 1px solid var(--p-primary-color); /* Show border on hover */
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem; /* 6px equivalent */
    white-space: nowrap; /* Keep text on a single line */
    overflow: hidden; /* Hide overflowing text */
    text-overflow: ellipsis; /* Add ellipsis for truncated text */
}

.color-box {
  width: 1rem; /* 16px equivalent */
  height: 1rem;
  border: 0.0625rem solid #000; /* 1px equivalent */
}

.label {
  font-size:smaller;
  line-height: 1.2; /* Adjust line height */
  color: var(--p-primary-color);
}

.sr-lb-fieldset {
    padding: 0.2rem; /* 3.2px equivalent */
    background-color: rgba(0, 0, 0, 0.2); /* Black with 50% transparency */
    border-radius: var(--p-border-radius);
    position: relative; /* Enable positioning for the legend */
}

/* Custom Fieldset legend style */
:deep(.sr-lb-fieldset .p-fieldset-legend) {
    white-space: nowrap;
    font-size: small;
    font-weight: normal;
    color: var(--p-primary-color);
    padding: 0.2rem;
    text-align: center;
    position: absolute;
    top: 0.5rem;
    left: 50%;
    transform: translate(-50%, -50%);
    background: transparent;
    border-radius: 0.25rem;
    border-color: transparent;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 1;
    margin: 0.5rem;
    padding-left: 0.5rem; 
    padding-right:0.5rem; 
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
}

:deep(.p-fieldset-content-container) {
    padding-top: 1.5rem; /* Adjust padding to prevent overlap with the legend */
}
</style>
  