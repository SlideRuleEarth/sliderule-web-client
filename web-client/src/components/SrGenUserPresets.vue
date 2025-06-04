<script setup lang="ts">
import { ref,computed } from 'vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';

const reqParameterStore = useReqParamsStore();
const selectedBox = ref<number | null>(null);

const boxes = computed(() => [
  { id: 1, name: "ICESat-2 Surface Elevations", description: "For all surface types", image: "/SrGround.webp" },
  { id: 2, name: "ICESat-2 Land Ice Sheet", description: "For ice sheets and glaciers", image: "/SrSeaIce.webp" },
  { id: 3, name: "ICESat-2 Canopy Heights", description: "For land regions with vegetation", image: "/SrCanopy.webp" },
  { id: 4, name: "ICESat-2 Coastal Bathymetry", description: "For shallow water coastal regions", image: "/SrOcean.webp" },
  { id: 5, name: "ICESat-2 Geolocated Photons", description: "For raw photon cloud", image: "/SrNoise.webp" },
  { id: 6, name: "GEDI Biomass Density", description: "For land regions with vegetation", image: "/SrCanopy.webp" },
  { id: 7, name: "GEDI Elevations w/Canopy", description: "For elevation w/Canopy heights", image: "/SrInlandWater.webp" },
  { id: 8, name: "GEDI Geolocated Waveforms", description: "For raw waveform returns", image: "/SrGround.webp" },
]);

const selectBox = (boxId: number) => {
  selectedBox.value = boxId;
  const selectedBoxInfo = boxes.value.find(box => box.id === boxId);
  if (!selectedBoxInfo) {
    console.error("GenUserOptions Unknown selection.");
    return;
  }
  if (selectedBoxInfo?.name) {
    console.log(`${selectedBoxInfo.name} box selected.`);
    let savedPoly = reqParameterStore.poly;
    let savedConvexHull = reqParameterStore.convexHull;
    switch (selectedBoxInfo.name) {
      case 'ICESat-2 Surface Elevations':
        reqParameterStore.reset();
        reqParameterStore.setMissionValue('ICESat-2');
        reqParameterStore.setIceSat2API('atl06p');
        reqParameterStore.setAsset('icesat2');
        break;
      case 'ICESat-2 Land Ice Sheet':
        reqParameterStore.reset();
        reqParameterStore.setMissionValue('ICESat-2');
        reqParameterStore.setIceSat2API('atl06sp');
        reqParameterStore.setAsset('icesat2-atl06');
        break;
      case 'ICESat-2 Canopy Heights':
        reqParameterStore.reset();
        reqParameterStore.setMissionValue('ICESat-2');
        reqParameterStore.setIceSat2API('atl08p');
        reqParameterStore.setAsset('icesat2');
        break;
      case 'ICESat-2 Coastal Bathymetry':
        reqParameterStore.reset();
        reqParameterStore.setMissionValue('ICESat-2');
        reqParameterStore.setIceSat2API('atl24x');
        reqParameterStore.setAsset('icesat2');
        break;
      case 'ICESat-2 Geolocated Photons':
        reqParameterStore.reset();
        reqParameterStore.setMissionValue('ICESat-2');
        reqParameterStore.setIceSat2API('atl03x');
        reqParameterStore.setAsset('icesat2');
        break;
      case 'GEDI Biomass Density':
        reqParameterStore.reset();
        reqParameterStore.setMissionValue('GEDI');
        reqParameterStore.setGediAPI('gedi04ap');
        reqParameterStore.setAsset('gedil4a');
        break;
      case 'GEDI Elevations w/Canopy':
        reqParameterStore.reset();
        reqParameterStore.setMissionValue('GEDI');
        reqParameterStore.setGediAPI('gedi02ap');
        reqParameterStore.setAsset('gedil2a');
        break;
      case 'GEDI Geolocated Waveforms':
        reqParameterStore.reset();
        reqParameterStore.setMissionValue('GEDI');
        reqParameterStore.setGediAPI('gedi01bp');
        reqParameterStore.setAsset('gedil1b');
        break;
      default:
        console.error("GenUserOptions Unknown selection.");
        break;
    }
    reqParameterStore.poly = savedPoly;
    reqParameterStore.convexHull = savedConvexHull;
  }
};
</script>

<template>
  <div class="sr-radio-box-container" id="sr-radio-box-container-gen">
    <div
      v-for="box in boxes"
      :key="box.id"
      class="sr-radio-box"
      :class="{ 'selected': selectedBox === box.id }"
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
