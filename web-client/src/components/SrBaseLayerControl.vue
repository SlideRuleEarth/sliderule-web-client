<script setup lang="ts">
  import { useMapParamsStore } from "@/stores/mapParamsStore.js";
  import { ref,onMounted } from "vue";
  import { Control } from 'ol/control';
  import { baseLayers } from '@/composables/SrBaseLayers.js';



  const baseLayerControlElement = ref(null);

  const mapParamsStore = useMapParamsStore();

  const emit = defineEmits(['baseLayerControlCreated', 'updateBaseLayer']);

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
    console.log("updateBaseLayer:", selectedTitle);
    const layer = baseLayers.value.find(layer => layer.title === selectedTitle);
    //console.log("updateBaseLayer layer:", layer);
    if (layer) {
      //mapParamsStore.setBaseLayer(layer);
      emit('updateBaseLayer', layer);
      console.log("updateBaseLayer mapParamsStore.baseLayer:", mapParamsStore.baseLayer);
    }
  }
</script>

<template>
  <div ref="baseLayerControlElement" class="sr-base-layer-control ol-unselectable ol-control">
    <form class="select-baselayer" name="sr-select-baselayer-form">
      <select @change="updateBaseLayer(($event.target as HTMLInputElement).value)" class="select-default" name="sr-select-baselayer-menu">
        <option v-for="layer in baseLayers" :value="layer.title" :key="layer.title">
          {{ layer.title }}
        </option>
      </select>
      <span class="sr-base-layer-control-attribution">{{ mapParamsStore.baseLayer.attribution }}</span>
    </form>
  </div>

</template>

<style scoped>

  .ol-control.sr-base-layer-control .select-baselayer select {
    color: white;
    background-color: black;
    border-radius: var(--border-radius);
  }

  .sr-base-layer-control-attribution {
    color: var(--primary-color); 
    margin: 0.5em;
    padding: 0.5em;
    background-color:transparent;
  }
</style>
