<template>
<div class="sr-draw-button-box">
    <SrRadioButton
    class="sr-draw-button"
      v-model="picked"
      value="Polygon"
      :icon="getPolygonIcon"
      aria-label="Select Polygon"
      tooltip-text="Draw a Polygon"
    />
    <span class="sr-button-box-divider"></span>
    <SrRadioButton
    class="sr-draw-button"
    v-model="picked"
    value="Box"
    :icon="getRectangleIcon"
    aria-label="Select Rectangle"
    tooltip-text="Draw a Rectangle"
    />
</div>
</template>

<script setup lang="ts">
  import { onMounted, ref, computed, watch } from 'vue'
  import SrRadioButton from './SrRadioButton.vue';
  import { useMapParamsStore } from "@/stores/mapParamsStore.js";

  const mapParamsStore = useMapParamsStore();
  const picked = ref(mapParamsStore.drawType);
  const emit = defineEmits(['drawButtonBoxCreated', 'pickedChanged']);
  
  onMounted(() => {
    //console.log("SrDrawButtonBox onMounted");
    emit('drawButtonBoxCreated', picked);
  });

  watch(picked, (newValue) => {
    //console.log("SrDrawButtonBox picked changed:", newValue);
    emit('pickedChanged', newValue);
    if (newValue === 'Box'){
      console.log("SrDrawButtonBox picked changed to Box HACKED TO CIRCLE!!!");
      newValue = 'Circle';
    }
    mapParamsStore.drawType = newValue;
  });

  const getCssVariable = (variable) => {
    return getComputedStyle(document.documentElement).getPropertyValue(variable);
  };

  const primaryColor = getCssVariable('--primary-color').trim() || 'blue'; // Fallback to blue if variable is not set

  const getPolygonIcon = computed(() => {
  //console.log("getPolygonIcon picked:", picked.value)
  return `<svg width="65%" height="65%" viewBox="0 0 100 100">
    <polygon points="50,10 90,40 70,90 30,90 10,40" fill="none" stroke="${picked.value === 'Polygon' ? primaryColor : 'white'}" stroke-width="7" />
  </svg>`;
});

const getRectangleIcon = computed(() => {
  //console.log("getRectangleIcon picked:", picked.value)
  return `<svg width="65%" height="65%" viewBox="0 0 100 50">
    <rect width="100" height="50" fill="none" stroke="${picked.value === 'Box' ? primaryColor : 'white'}" stroke-width="7" />
  </svg>`;
});

</script>

<style scoped>
.sr-draw-button-box {
  display: flex; /* Aligns children (input and icon) in a row */
  flex-direction: column; /* Stack children vertically */
  align-items: center; /* Centers children vertically */
  justify-content: center; /* Centers children horizontally */
  margin: 0px;
}
.sr-button-box-divider {
  margin: 0.125em;
  padding: 0px;
  border-top: 1px dashed rgb(200, 200, 200);
  width: 50%;
}
</style>
