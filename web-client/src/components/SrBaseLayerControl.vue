<script setup lang="ts">
  import { useMapParamsStore } from "@/stores/mapParamsStore.js";
  import { ref,onMounted } from "vue";
  import { Control } from 'ol/control';
  
  const baseLayerControlElement = ref(null);
  const mapParamsStore = useMapParamsStore();
  const baseLayers = ref([
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      title: "Esri-World-Topo"
    },
    {
      url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      title: "OpenStreet"
    },
    {
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      title: "Google"
    }
  ]);

  const emit = defineEmits(['baseLayerControlCreated', 'baseLayerChanged']);

  onMounted(() => {
    //console.log("SrBaseLayerControl onMounted baseLayerControlElement:", baseLayerControlElement.value);
    if (baseLayerControlElement.value) {
      const customControl = new Control({ element: baseLayerControlElement.value });
      emit('baseLayerControlCreated', customControl);
      //console.log("SrBaseLayerControl onMounted customControl:", customControl);
    }
    if (!mapParamsStore.baseLayer) {
      // Set default base layer if not already set
      mapParamsStore.baseLayer = baseLayers.value[0];
    }
  });
  

  function updateBaseLayer(selectedTitle: string) {
    //console.log("updateBaseLayer:", selectedTitle);
    const layer = baseLayers.value.find(layer => layer.title === selectedTitle);
    //console.log("updateBaseLayer layer:", layer);
    if (layer) {
      mapParamsStore.setBaseLayer(layer);
      //emit('baseLayerChanged', layer.title);
    }
  }
</script>

<template>
  <div ref="baseLayerControlElement" class="sr-base-layer-control ol-unselectable ol-control">
    <form class="select-src">
      <select @change="updateBaseLayer(($event.target as HTMLInputElement).value)" class="select-default">
        <option v-for="layer in baseLayers" :value="layer.title" :key="layer.title">
          {{ layer.title }}
        </option>
      </select>
    </form>
  </div>

</template>
