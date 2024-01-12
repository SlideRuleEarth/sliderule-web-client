<template>
  <SrDrawButtonBox ref="drawButtonBox" @drawButtonBoxCreated="handleDrawButtonBoxCreated"/>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Control } from 'ol/control';
import SrDrawButtonBox from './SrDrawButtonBox.vue';

const emit = defineEmits(['drawControlCreated']);

const drawButtonBox = ref<InstanceType<typeof SrDrawButtonBox> | null>(null);
const handleDrawButtonBoxCreated = (picked: any) => {
  console.log("handleDrawButtonBoxCreated: " + picked.value);
};

onMounted(() => {
  console.log("SrDrawControl onMounted");
  const element = document.createElement('div');
  element.className = 'sr-draw-control ol-unselectable ol-control';
  if(drawButtonBox.value == null){
    console.log("Error:drawButtonBox is null");
  } else {
    console.log("drawButtonBox is not null");
    element.appendChild(drawButtonBox.value.$el);
  }

  const customControl = new Control({ element });
  emit('drawControlCreated', customControl);

});
</script>

