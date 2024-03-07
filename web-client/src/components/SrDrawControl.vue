<template>
  <SrDrawButtonBox ref="drawButtonBox" @picked-changed="handlePickedChange"/>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Control } from 'ol/control';
import SrDrawButtonBox from './SrDrawButtonBox.vue';
import { useMapParamsStore } from "@/stores/mapParamsStore.js";

const mapParamsStore = useMapParamsStore();

const emit = defineEmits(['draw-control-created']);

const drawButtonBox = ref<InstanceType<typeof SrDrawButtonBox> | null>(null);

onMounted(() => {
  //console.log("SrDrawControl onMounted");
  const element = document.createElement('div');
  element.className = 'sr-draw-control ol-unselectable ol-control';
  if(drawButtonBox.value == null){
    console.log("Error:drawButtonBox is null");
  } else {
    //console.log("drawButtonBox is not null");
    element.appendChild(drawButtonBox.value.$el);
  }

  const customControl = new Control({ element });
  emit('draw-control-created', customControl);

});

defineExpose({
  resetPicked() {
    console.log("SrDrawControl resetPicked");
    drawButtonBox.value?.resetPicked();
  }
});


const handlePickedChange = (newPickedValue: string) => {
    console.log(`Picked value changed: ${newPickedValue}`);
    mapParamsStore.drawType = newPickedValue;
    // Handle the change as needed
};
</script>

