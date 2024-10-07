<script setup lang="ts">
import { ref } from 'vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { useAdvancedModeStore } from '@/stores/advancedModeStore';

const reqParameterStore = useReqParamsStore();
const selectedBox = ref<number | null>(null);

const boxes = [
  { id: 1, hide: (false && !useAdvancedModeStore().getAdvanced()), name: "ICESat-2 Surface Elevations", description: "For all surface types", image: "/SrGround.webp" },
  { id: 2, hide: (true  && !useAdvancedModeStore().getAdvanced()), name: "ICESat-2 Land Ice Sheet", description: "For ice sheets and glaciers", image: "/SrSeaIce.webp" },
  { id: 3, hide: (false && !useAdvancedModeStore().getAdvanced()), name: "ICESat-2 Canopy Heights", description: "For land regions with vegetation", image: "/SrCanopy.webp" },
  { id: 4, hide: (true  && !useAdvancedModeStore().getAdvanced()),  name: "ICESat-2 Coastal Bathymetry", description: "For shallow water coastal regions", image: "/SrOcean.webp" },
  { id: 5, hide: (true  && !useAdvancedModeStore().getAdvanced()),  name: "ICESat-2 Geolocated Photons", description: "For raw photon cloud", image: "/SrNoise.webp" },
  { id: 6, hide: (true  && !useAdvancedModeStore().getAdvanced()),  name: "GEDI Aboveground Biomass Density", description: "For land regions with vegetation", image: "/SrCanopy.webp" },
  { id: 7, hide: (true  && !useAdvancedModeStore().getAdvanced()),  name: "GEDI Canopy Heights", description: "For geolocated elevation and height metrics", image: "/SrInlandWater.webp" },
  { id: 8, hide: (true  && !useAdvancedModeStore().getAdvanced()),  name: "GEDI geolocated Waveforms", description: "For raw waveform returns", image: "/SrGround.webp" },
];

const selectBox = (boxId: number) => {
  selectedBox.value = boxId;
  const selectedBoxInfo = boxes.find(box => box.id === boxId);
  if (!selectedBoxInfo) {
    console.error("GenUserOptions Unknown selection.");
    return;
  }
  if (selectedBoxInfo?.name) {
    console.log(`${selectedBoxInfo.name} box selected.`);
    switch (selectedBoxInfo.name) {
      case 'ICESat-2 Surface Elevations':
        reqParameterStore.setMissionValue('ICESat-2');
        reqParameterStore.setIceSat2API('atl06p');
        break;
      case 'ICESat-2 Land Ice Sheet':
        reqParameterStore.setMissionValue('ICESat-2');
        reqParameterStore.setIceSat2API('atl06sp');
        break;
      case 'ICESat-2 Canopy Heights':
        reqParameterStore.setMissionValue('ICESat-2');
        reqParameterStore.setIceSat2API('atl08p');
        break;
      case 'ICESat-2 Coastal Bathymetry':
        reqParameterStore.setMissionValue('ICESat-2');
        reqParameterStore.setIceSat2API('atl24s');
        break;
      case 'ICESat-2 Geolocated Photons':
        reqParameterStore.setMissionValue('ICESat-2');
        reqParameterStore.setIceSat2API('atl03vp');
        break;
      case 'GEDI Aboveground Biomass Density':
        reqParameterStore.setMissionValue('GEDI');
        reqParameterStore.setGediAPI('gedi04ap');
        break;
      case 'GEDI Canopy Heights':
        reqParameterStore.setMissionValue('GEDI');
        reqParameterStore.setGediAPI('gedi02ap');
        break;
      case 'GEDI geolocated Waveforms':
        reqParameterStore.setMissionValue('GEDI');
        reqParameterStore.setGediAPI('gedi01bp');
        break;
      default:
        console.error("GenUserOptions Unknown selection.");
        break;
    }
  }
};
</script>

<template>
  <div class="sr-radio-box-container">
    <div
      v-for="box in boxes"
      :key="box.id"
      class="sr-radio-box"
      :class="{ 'selected': selectedBox === box.id, 'insensitive': box.hide }"
      @click="!box.hide && selectBox(box.id)"
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
  border-color: #A4DEEB;
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
