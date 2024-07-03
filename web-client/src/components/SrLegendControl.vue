<template>
  <SrLegendBox ref="legendBox" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Control } from 'ol/control';
import SrLegendBox from './SrLegendBox.vue';


const emit = defineEmits(['legend-control-created']);

const legendBox = ref<InstanceType<typeof SrLegendBox> | null>(null);

onMounted(() => {
  //console.log("SrLegendControl onMounted");
  const element = document.createElement('div');
  element.className = 'sr-legend-control ol-unselectable ol-control';
  if(legendBox.value == null){
    console.error("Error:legendBox is null");
  } else {
    //console.log("legendBox is not null");
    element.appendChild(legendBox.value.$el);
  }

  const customControl = new Control({ element });
  emit('legend-control-created', customControl);

});

</script>
