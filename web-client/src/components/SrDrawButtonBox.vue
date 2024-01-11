<template>
<div class="draw-button-box">
    <SrRadioButton
    class="sr-draw-button"
      v-model="picked"
      value="Polygon"
      icon="polyline"
    />
    <SrRadioButton
    class="sr-draw-button"
    v-model="picked"
    value="Box"
    icon="check_box_outline_blank"
    />
</div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import SrRadioButton from './SrRadioButton.vue';
  const picked = ref('Polygon');
</script>
<style scoped>
.sr-draw-button {
    border: 1px solid #ccc; /* thin, solid, grey border */
}
</style>
<style scoped>
.draw-button-box {
    display: flex; /* Aligns children (input and icon) in a row */
    flex-direction: column; /* Stack children vertically */
    align-items: center; /* Centers children vertically */
    justify-content: center; /* Centers children horizontally */
}
</style>
