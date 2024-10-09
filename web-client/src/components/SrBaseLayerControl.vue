<script setup lang="ts">
    import { useMapParamsStore } from "@/stores/mapParamsStore";
    import { ref,onMounted } from "vue";
    import { Control } from 'ol/control';
    import { computed } from 'vue';
    import { getSrBaseLayersForView, getDefaultBaseLayer } from '@/composables/SrLayers.js';
    import { getDefaultProjection } from '@/composables/SrProjections';

    const mapParamsStore = useMapParamsStore();
    const baseLayerOptions = computed(() => getSrBaseLayersForView(mapParamsStore.srView.name));
    const baseLayerOptionNames = computed(() => baseLayerOptions.value.map(layer => layer.title));
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
    });

    // Define a computed property that references the getter and setter
    const selectedMenuItem = computed({
        get() {
            const menuItem = mapParamsStore.getSelectedBaseLayerName();
            //console.log('SrMenu:', props.label, 'get:', menuItem);
            return menuItem; // calling the getter function
        },
        set(value) {
            //console.log('SrMenu:', props.label, 'set:', value)
            const oldBaseLayer = mapParamsStore.getSelectedBaseLayer();
            mapParamsStore.setSelectedBaseLayerByName(value); // calling the setter function
            emit('update-baselayer', oldBaseLayer);
        }
    });
</script>

<template>
  <div ref="baseLayerControlElement" class="sr-base-layer-control ol-unselectable ol-control">
    <form class="select-baselayer" name="sr-select-baselayer-form">
      <select v-model="selectedMenuItem" class="select-default" name="sr-select-baselayer-menu">
        <option v-for="layer in baseLayerOptionNames" :value="layer" :key="layer">
          {{ layer }}
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

</style>
