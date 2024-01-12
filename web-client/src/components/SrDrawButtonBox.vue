<template>
<div class="sr-draw-button-box">
    <SrRadioButton
    class="sr-draw-button"
      v-model="picked"
      value="Polygon"
      :icon="polygonIcon"
    />
    <SrRadioButton
    class="sr-draw-button"
    v-model="picked"
    value="Box"
    :icon="rectangleIcon"
    />
</div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import SrRadioButton from './SrRadioButton.vue';
  const picked = ref('Polygon');
  const emit = defineEmits(['drawButtonBoxCreated']);
  onMounted(() => {
    console.log("SrDrawButtonBox onMounted");
    emit('drawButtonBoxCreated', picked);
  });
  const polygonIcon = `<svg width="50%" height="50%" viewBox="0 0 100 100">
  <polygon points="50,10 90,40 70,90 30,90 10,40" fill="none" stroke="white" stroke-width="8" />
</svg>
`;

  const rectangleIcon = `<svg width="50%" height="50%" viewBox="0 0 100 50">
  <rect width="100" height="50" fill="none" stroke="white" stroke-width="8" />
</svg>`;

</script>

<style scoped>
.sr-draw-button-box {
  display: flex; /* Aligns children (input and icon) in a row */
  flex-direction: column; /* Stack children vertically */
  align-items: center; /* Centers children vertically */
  justify-content: center; /* Centers children horizontally */
  margin: 2px;
}
</style>
