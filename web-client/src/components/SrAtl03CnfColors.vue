<template>
  <div class="sr-legend-box" v-if="atl03CnfColorMapStore">
    <Fieldset
      class="sr-lb-fieldset"
      legend="Atl03 Cnf Colors"
      :toggleable="false"
      :collapsed="false"
    >
      <div v-for="option in atl03CnfOptions" :key="option.value" class="legend-item">
        <div
          class="color-box"
          :style="{ backgroundColor: atl03CnfColorMapStore.getColorForAtl03CnfValue(option.value) }"
        ></div>
        <div class="label">{{ formatLabel(option.label) }} ({{ option.value }})</div>
      </div>
    </Fieldset>
  </div>
  <div v-else>Loading atl03CnfColorMap...</div>
</template>

<script setup lang="ts">
import { onMounted, computed, watch, ref } from 'vue'
import Fieldset from 'primevue/fieldset'
import { useAtl03CnfColorMapStore } from '@/stores/atl03CnfColorMapStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrAtl03CnfColors')

const emit = defineEmits(['restore-atl03-color-defaults-click', 'atl03CnfColorChanged'])
const props = defineProps({
  reqIdStr: {
    type: String,
    required: true
  }
})

const atl03CnfColorMapStore = ref<any>(null)

onMounted(() => {
  // Any initialization logic can go here
  atl03CnfColorMapStore.value = useAtl03CnfColorMapStore(props.reqIdStr)
})

// Reactive options computed from the store
const atl03CnfOptions = computed(() => atl03CnfColorMapStore.value.atl03CnfOptions)

// Watch for changes in the color map and trigger reactivity
watch(
  () => atl03CnfColorMapStore.value?.atl03CnfColorMap,
  (newMap, _oldMap) => {
    // Emit an event or trigger any logic when the color map changes
    emit('atl03CnfColorChanged', newMap)
    logger.debug('Color map changed', { newMap })
  },
  { deep: true } // Deep watch for changes inside the object
)

// Formatting labels for better readability
const formatLabel = (label: string): string => {
  if (!label) return ''
  return label.replace(/^atl03_/, '').replace(/_/g, ' ')
}
</script>

<style scoped>
.sr-legend-box {
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px equivalent */
  color: var(--p-primary-color);
  border-radius: var(--p-border-radius);
  border: 1px solid transparent; /* Initially transparent */
  transition: border 0.3s ease-in-out; /* Smooth transition effect */
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
  font-size: smaller;
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
  padding-right: 0.5rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

:deep(.p-fieldset-content-container) {
  padding-top: 1.5rem; /* Adjust padding to prevent overlap with the legend */
}
</style>
