<script setup lang="ts">
  import { useMapParamsStore } from "@/stores/mapParamsStore";
  import { ref,onMounted } from "vue";
  import { Control } from 'ol/control';
  import { computed } from 'vue';
  import { getSrBaseLayersForView, getDefaultBaseLayer } from '@/composables/SrLayers.js';
  import { getDefaultProjection } from '@/composables/SrProjections';

  const mapParamsStore = useMapParamsStore();
  const baseLayerOptions = computed(() => getSrBaseLayersForView(mapParamsStore.srView.name));
  // Computed property to bind selectedBaseLayer with the store
  const selectedBaseLayerTitle = computed({
    get: () => mapParamsStore.getSelectedBaseLayer().title,
    set: (title) => {
      if(baseLayerOptions.value){
        const oldBaseLayer = mapParamsStore.getSelectedBaseLayer();
        //console.log(`setting selectedBaseLayer from: ${mapParamsStore.getSelectedBaseLayer().title}  to ${title}`);
        const srLayer = baseLayerOptions.value.find(srLayer => srLayer.title === title);
        if (srLayer) {
          mapParamsStore.setSelectedBaseLayer(srLayer); 
          emit('update-baselayer', oldBaseLayer);
        }
      } else {
        console.error(`No baseLayerOptions for projection: ${mapParamsStore.projection}`);
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
    const defaultBaseLayer = getDefaultBaseLayer(getDefaultProjection().name);
    if (defaultBaseLayer) {
      mapParamsStore.setSelectedBaseLayer(defaultBaseLayer);
    }
    //console.log(`SrBaseLayerControl onMounted selectedBaseLayer: ${mapParamsStore.selectedBaseLayer.title} defaultBaseLayer: ${defaultBaseLayer?.title}`);
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
    </form>
  </div>

</template>

<style scoped>

  .ol-control.sr-base-layer-control .select-baselayer select {
    color: white;
    background-color: black;
    border-radius: var(--p-border-radius);
  }

  /* .sr-base-layer-control-attribution {
    color: var(--p-primary-color); 
    margin: 0.5em;
    padding: 0.5em;
    background-color:transparent;
  } */
</style>
