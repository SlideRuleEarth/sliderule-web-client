<template>
  <div ref="dropPinWrapper">
    <SrCustomTooltip ref="tooltipRef" id="editDecrTooltip" />
    <SrCustomTooltip ref="remTooltipRef" id="editDecrTooltip" />
    <Button
      :icon="'pi pi-map-marker'"
      :class="['sr-drop-pin-button', { active: mapStore.dropPinEnabled }]"
      @click="toggleDropPinEnabled"
      rounded
      text
      size="small"
      aria-label="Toggle Drop Pin"
      @mouseover="showTooltip"
      @mouseleave="hideTooltip"
    />
    <Button
      :icon="'pi pi-times'"
      :class="[
        'sr-drop-pin-button',
        { active: reqParamsStore.useAtl13Point && reqParamsStore.atl13.coord !== null }
      ]"
      @click="removeDropPin"
      rounded
      text
      size="small"
      aria-label="Remove Drop Pin"
      @mouseover="remShowTooltip"
      @mouseleave="remHideTooltip"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Control } from 'ol/control'
import { useMapStore } from '@/stores/mapStore'
import Button from 'primevue/button'
import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
import { useToast } from 'primevue'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrDropPinControl')
const toast = useToast()
const recTreeStore = useRecTreeStore()
const reqParamsStore = useReqParamsStore()

const mapStore = useMapStore()
const emit = defineEmits(['drop-pin-control-created'])

const dropPinWrapper = ref<HTMLElement | null>(null)
const tooltipRef = ref()
const remTooltipRef = ref()
const toolTipStrRef = ref('Click to toggle drop pin mode')

onMounted(() => {
  const element = document.createElement('div')
  element.className = 'sr-drop-pin-control ol-unselectable ol-control'
  if (dropPinWrapper.value) {
    element.appendChild(dropPinWrapper.value)
  } else {
    logger.error('dropPinWrapper is null')
  }

  const customControl = new Control({ element })
  emit('drop-pin-control-created', customControl)
  const apiCounts = recTreeStore.countRequestsByApi()
  logger.debug('API Counts', { apiCounts })
  if (!apiCounts.atl13x || apiCounts.atl13x < 3) {
    toast.add({
      severity: 'info',
      summary: 'Atl13x Enter Coordinates for Inland Water',
      detail:
        'Click on the map Drop Pin button to toggle drop pin mode. Then click on an inland body of water to add it to the request.',
      life: 5000
    })
  }
})
const showTooltip = (event: MouseEvent) => {
  tooltipRef.value?.showTooltip(event, toolTipStrRef.value)
}

const hideTooltip = () => {
  tooltipRef.value?.hideTooltip()
}

const remShowTooltip = (event: MouseEvent) => {
  remTooltipRef.value?.showTooltip(event, 'Click to remove dropped pin')
}

const remHideTooltip = () => {
  remTooltipRef.value?.hideTooltip()
}

const toggleDropPinEnabled = () => {
  mapStore.dropPinEnabled = !mapStore.dropPinEnabled
  if (mapStore.dropPinEnabled) {
    toolTipStrRef.value =
      "toggleDropPinEnabled - Drop a pin on an inland body of water to add it to use it's coordinates in the request."
  } else {
    toolTipStrRef.value =
      "toggleDropPinEnabled - Click to toggle drop pin mode, then drop a pin on an inland body of water to add it to use it's coordinates in the request "
  }
  logger.debug('toggleDropPinEnabled', { useAtl13Point: reqParamsStore.useAtl13Point })
}

const removeDropPin = () => {
  reqParamsStore.removePin()
  logger.debug('removeDropPin', { useAtl13Point: reqParamsStore.useAtl13Point })
}
</script>
<style scoped>
.sr-drop-pin-button {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  background-color: black;
  border-radius: 50%;
  border: none;
  box-shadow: none;
  transition:
    color 0.2s,
    background-color 0.2s;
}

/* Force icon color to white when off */
.sr-drop-pin-button :deep(.p-button-icon) {
  color: white;
}

/* Change icon color when active (on) */
.sr-drop-pin-button.active :deep(.p-button-icon) {
  color: var(--p-primary-color);
}
</style>
