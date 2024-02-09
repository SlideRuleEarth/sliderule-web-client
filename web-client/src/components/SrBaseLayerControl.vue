<script setup lang="ts">
  import { useMapParamsStore } from "@/stores/mapParamsStore.js";
  import { ref,onMounted } from "vue";
  import { Control } from 'ol/control';
  import { computed } from 'vue';
  import { getBaseLayersForProjection, getDefaultBaseLayer } from '@/composables/SrLayers.js';
  
  const mapParamsStore = useMapParamsStore();
  const baseLayerOptions = computed(() => getBaseLayersForProjection(mapParamsStore.projection.name));
  // Computed property to bind selectedLayers with the store
  const selectedBaseLayerTitle = computed({
    get: () => mapParamsStore.getSelectedBaseLayer().title,
    set: (title) => {
      if(baseLayerOptions.value){
        const layer = baseLayerOptions.value.find(layer => layer.title === title);
        if (layer) {
          mapParamsStore.setSelectedBaseLayer(layer); 
          emit('update-baselayer', layer);
        }
      }
    },
  });

  const baseLayerControlElement = ref(null);
  const emit = defineEmits(['baselayer-control-created', 'update-baselayer']);

  onMounted(() => {
    //console.log("SrBaseLayerControl onMounted baseLayerControlElement:", baseLayerControlElement.value);

    if (baseLayerControlElement.value) {
      const customControl = new Control({ element: baseLayerControlElement.value });
      emit('baselayer-control-created', customControl);
      //console.log("SrBaseLayerControl onMounted customControl:", customControl);
    }
    const defaultBaseLayer = getDefaultBaseLayer();
    if (defaultBaseLayer) {
      mapParamsStore.setSelectedBaseLayer(defaultBaseLayer);
    }
    // baseLayerOptions.value.forEach(layer => {
    //   console.log(`Title: ${layer.title}}`);
    // });
  });
</script>

<template>
  <div ref="baseLayerControlElement" class="sr-base-layer-control ol-unselectable ol-control">
    <form class="select-baselayer" name="sr-select-baselayer-form">
      <select v-model="selectedBaseLayerTitle" class="select-default" name="sr-select-baselayer-menu">
        <option v-for="layer in baseLayerOptions" :value="layer.title" :key="layer.title">
          {{ layer.title }}
        </option>
      </select>
      <span class="sr-base-layer-control-attribution">{{ mapParamsStore.selectedBaseLayer.attribution }}</span>
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
