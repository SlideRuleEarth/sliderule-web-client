<template>
<div>
    <SrRadioButton
      v-model="picked"
      value="Polygon"
      icon="polyline"
    />
    <br>
    <SrRadioButton
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