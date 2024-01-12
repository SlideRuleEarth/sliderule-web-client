<template>
  <DrawButtonBox />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Control } from 'ol/control';
import DrawButtonBox from './SrDrawButtonBox.vue';


const emit = defineEmits(['customControlCreated']);

const el = ref(null);

onMounted(() => {
  if(el.value) {
    const element = document.createElement('div');
    element.className = 'draw-control ol-unselectable ol-control';
    element.appendChild(el.value);

    const customControl = new Control({ element });
    emit('customControlCreated', customControl);

  } else {
    console.error('el is undefined');
  }
});
</script>

<style scoped>
.draw-control button {
  background-color: white;
  border: none;
  
  border-radius: var(--border-radius);
  cursor: pointer;
}
</style>
