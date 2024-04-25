<script setup lang="ts">
  import { useMapParamsStore } from "@/stores/mapParamsStore";
  import { ref,onMounted } from "vue";
  import { Control } from 'ol/control';

  const mapParamsStore = useMapParamsStore();

  const emit = defineEmits(['attributionControlCreated']);

  onMounted(() => {
    //console.log("SrBaseLayerControl onMounted baseLayerControlElement:", baseLayerControlElement.value);

  });
  

</script>

<template>
  <div ref="attributionControlElement" class="sr-attribution-control ol-unselectable ol-control">
    
  </div>

</template>
