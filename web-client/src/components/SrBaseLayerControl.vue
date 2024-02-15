<script setup lang="ts">
  import { useMapParamsStore } from "@/stores/mapParamsStore.js";
  import { ref,onMounted } from "vue";
  import { Control } from 'ol/control';
  import { computed } from 'vue';
  import { getSrBaseLayersForProjection, getDefaultBaseLayer } from '@/composables/SrLayers.js';
  import { useMapStore } from "@/stores/mapStore";
  import { watch } from 'vue';
  import { getDefaultProjection } from '@/composables/SrProjections';
  import { srAttributions } from '@/composables/SrLayers';

  const mapStore = useMapStore();
  const mapParamsStore = useMapParamsStore();
  const baseLayerOptions = computed(() => getSrBaseLayersForProjection(mapParamsStore.projection.name));
  // Computed property to bind selectedBaseLayer with the store
  const selectedBaseLayerTitle = computed({
    get: () => mapParamsStore.getSelectedBaseLayer().title,
    set: (title) => {
      if(baseLayerOptions.value){
        //console.log(`setting selectedBaseLayer from: ${mapParamsStore.getSelectedBaseLayer().title}  to ${title}`);
        setBaseLayerTitle(title);
        const srLayer = baseLayerOptions.value.find(srLayer => srLayer.title === title);
        if (srLayer) {
          mapParamsStore.setSelectedBaseLayer(srLayer); 
          emit('update-baselayer', srLayer);
        }
      } else {
        console.error(`No baseLayerOptions for projection: ${mapParamsStore.projection.name}`);
      }
    },
  });

  function setBaseLayerTitle(title: string){
    const map = mapStore.getMap();
    if(map){
      const layer = map.getAllLayers().find(layer => layer.get('name') === 'Base Layer');
      console.log(`Base Layer: ${layer} new title: ${title}`);
      if(layer){
        layer.set('title',title);
      }
    }
  }
  const baseLayerControlElement = ref(null);
  const emit = defineEmits(['baselayer-control-created', 'update-baselayer']);

  onMounted(() => {
    //console.log("SrBaseLayerControl onMounted baseLayerControlElement:", baseLayerControlElement.value);

    if (baseLayerControlElement.value) {
      const customControl = new Control({ element: baseLayerControlElement.value });
      emit('baselayer-control-created', customControl);
      //console.log("SrBaseLayerControl onMounted customControl:", customControl);
    }
    const defaultBaseLayer = getDefaultBaseLayer(getDefaultProjection().name);
    if (defaultBaseLayer) {
      mapParamsStore.setSelectedBaseLayer(defaultBaseLayer);
    }
    // baseLayerOptions.value.forEach(layer => {
    //   console.log(`Title: ${layer.title}}`);
    // });
  });

  watch(() => mapParamsStore.projection.name, (newProjection) => {
    console.log(`SrBaseLayerControl watch newProjection: ${newProjection}`);
    const defaultBaseLayerForNewProjection = getDefaultBaseLayer(newProjection); 
    if (defaultBaseLayerForNewProjection){
      mapParamsStore.setSelectedBaseLayer(defaultBaseLayerForNewProjection);
      setBaseLayerTitle(mapParamsStore.getSelectedBaseLayer().title);
    } else {
      console.error(`No default base layer for projection: ${newProjection}`);  
    }
    emit('update-baselayer', defaultBaseLayerForNewProjection);
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
      <span class="sr-base-layer-control-attribution">{{ srAttributions[mapParamsStore.selectedBaseLayer.attributionKey] }}</span>
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
