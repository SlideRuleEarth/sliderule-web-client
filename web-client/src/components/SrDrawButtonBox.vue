<template>
<div>
    <SrRadioButton
    class="sr-draw-button"
      v-model="picked"
      value="Polygon"
      icon="polyline"
    />
    <br>
    <SrRadioButton
    class="sr-draw-button"
    v-model="picked"
    value="Box"
    icon="check_box_outline_blank"
    />
    <br>
    Picked value: {{ picked }}
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
