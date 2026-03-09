<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useSlideruleDefaults } from '@/stores/defaultsStore'
import { type SrPhoreal } from '@/types/slideruleDefaultsInterfaces'
import { onMounted } from 'vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrGenUserPresets')

const reqParameterStore = useReqParamsStore()
const selectedBox = ref<number | null>(null)

// Function to sync selectedBox with current API from store
const syncSelectedBoxFromStore = () => {
  const mission = reqParameterStore.getMissionValue()
  const api =
    mission === 'ICESat-2' ? reqParameterStore.getIceSat2API() : reqParameterStore.getGediAPI()

  logger.debug('Syncing selectedBox from store', { mission, api })

  // Map API to box ID
  if (mission === 'ICESat-2') {
    switch (api) {
      case 'atl03x-surface':
        selectedBox.value = 1 // ICESat-2 Surface Elevations
        break
      case 'atl06sp':
        selectedBox.value = 2 // ICESat-2 Land Ice Sheet
        break
      case 'atl03x-phoreal':
        selectedBox.value = 3 // ICESat-2 Canopy Heights
        break
      case 'atl24x':
        selectedBox.value = 4 // ICESat-2 Coastal Bathymetry
        break
      case 'atl03x':
        selectedBox.value = 5 // ICESat-2 Geolocated Photons
        break
      case 'atl13x':
        selectedBox.value = 6 // ICESat-2 Inland Bodies of Water
        break
      default:
        selectedBox.value = null
    }
  } else if (mission === 'GEDI') {
    switch (api) {
      case 'gedi04ap':
        selectedBox.value = 7 // GEDI Biomass Density
        break
      case 'gedi02ap':
        selectedBox.value = 8 // GEDI Elevations w/Canopy
        break
      case 'gedi01bp':
        selectedBox.value = 9 // GEDI Geolocated Waveforms
        break
      default:
        selectedBox.value = null
    }
  } else {
    selectedBox.value = null
  }

  logger.debug('Synced selectedBox', { selectedBox: selectedBox.value })
}

const boxes = computed(() => [
  {
    id: 1,
    name: 'ICESat-2 Surface Elevations',
    description: 'For all surface types',
    image: '/SrGround.webp'
  },
  {
    id: 2,
    name: 'ICESat-2 Land Ice Sheet',
    description: 'For ice sheets and glaciers',
    image: '/SrSeaIce.webp'
  },
  {
    id: 3,
    name: 'ICESat-2 Canopy Heights',
    description: 'For land regions with vegetation',
    image: '/SrCanopy.webp'
  },
  {
    id: 4,
    name: 'ICESat-2 Coastal Bathymetry',
    description: 'For shallow water coastal regions',
    image: '/SrOcean.webp'
  },
  {
    id: 5,
    name: 'ICESat-2 Geolocated Photons',
    description: 'For raw photon cloud',
    image: '/SrNoise.webp'
  },
  {
    id: 6,
    name: 'ICESat-2 Inland Bodies of Water',
    description: 'For inland bodies of water',
    image: '/SrInlandWater.webp'
  },
  {
    id: 7,
    name: 'GEDI Biomass Density',
    description: 'For land regions with vegetation',
    image: '/SrCanopy.webp'
  },
  {
    id: 8,
    name: 'GEDI Elevations w/Canopy',
    description: 'For elevation w/Canopy heights',
    image: '/SrCanopy.webp'
  },
  {
    id: 9,
    name: 'GEDI Geolocated Waveforms',
    description: 'For raw waveform returns',
    image: '/SrNoise.webp'
  }
])

const selectBox = (boxId: number) => {
  selectedBox.value = boxId
  const selectedBoxInfo = boxes.value.find((box) => box.id === boxId)
  if (!selectedBoxInfo) {
    logger.error('Unknown selection', { boxId })
    return
  }
  logger.debug('Box selected', { name: selectedBoxInfo.name })
  reqParameterStore.applyGeneralPreset(selectedBoxInfo.name)
}
let defaultPhoreal = {} as SrPhoreal

onMounted(() => {
  defaultPhoreal = useSlideruleDefaults().getNestedMissionDefault(
    'ICESat-2',
    'phoreal'
  ) as SrPhoreal
  logger.debug('Default PhoReal', { defaultPhoreal })

  // Sync selectedBox with current store state on mount
  syncSelectedBoxFromStore()
})

// Watch for API changes and sync selectedBox
watch(
  () => [
    reqParameterStore.getMissionValue(),
    reqParameterStore.getIceSat2API(),
    reqParameterStore.getGediAPI()
  ],
  () => {
    syncSelectedBoxFromStore()
  }
)
</script>

<template>
  <div class="sr-radio-box-container" id="sr-radio-box-container-gen">
    <div
      v-for="box in boxes"
      :key="box.id"
      class="sr-radio-box"
      :class="{ selected: selectedBox === box.id }"
      @click="selectBox(box.id)"
    >
      <img :src="box.image" :alt="box.name" class="sr-radio-box-image" />
      <div class="sr-radio-box-content">
        <h3>{{ box.name }}</h3>
        <p>{{ box.description }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sr-radio-box-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sr-radio-box {
  display: flex;
  align-items: center;
  background-color: #2c2c2c;
  border: 2px solid #3a3a3a;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0.75rem;
}

.sr-radio-box.selected {
  background-color: #3a3a3a;
  border-color: #a4deeb;
}

.sr-radio-box-image {
  width: 2.75rem;
  height: 2.75rem;
  margin-right: 1rem;
  object-fit: contain;
}

.sr-radio-box-content {
  display: flex;
  flex-direction: column;
}

.sr-radio-box-content h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.sr-radio-box-content p {
  margin: 0;
  font-size: 0.8rem;
  color: #a0a0a0;
}

.sr-radio-box.insensitive {
  opacity: 0.5;
  pointer-events: none;
}
</style>
