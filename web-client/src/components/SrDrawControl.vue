<template>
  <button ref="el" @click="handleClick">Custom Control</button>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Control } from 'ol/control';


const emit = defineEmits(['customControlCreated']);

const el = ref(null);
const handleClick = () => {
  console.log('Custom control clicked');
};

onMounted(() => {
  if(el.value) {
    const element = document.createElement('div');
    element.className = 'custom-control ol-unselectable ol-control';
    element.appendChild(el.value);

    const customControl = new Control({ element });
    emit('customControlCreated', customControl);

  } else {
    console.error('el is undefined');
  }
});
</script>

<style>
.custom-control button {
  background-color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
