<template>
<div class="sr-draw-button-box">
      <SrRadioButton
        v-if="(mapStore.polygonSource.value === 'Draw on Map')"
        name="drawButtonBoxPoly"
        class="sr-draw-poly-button"
        v-model="picked"
        value="Polygon"
        :icon="getPolygonIcon"
        aria-label="Select Polygon"
        tooltipText="Draw a Polygon"
      />
      <span class="sr-button-box-divider" v-if="(mapStore.polygonSource.value === 'Draw on Map')"></span>
      <SrRadioButton
        v-if="(mapStore.polygonSource.value === 'Draw on Map')"
        name="drawButtonBoxBox"
        class="sr-draw-box-button"
        v-model="picked"
        value="Box"
        :icon="getRectangleIcon"
        aria-label="Select Rectangle"
        tooltipText="Draw a Rectangle by clicking and dragging on the map."
      />
      <SrRadioButton
        name="drawButtonBoxTrashCan"
        class="sr-draw-trashcan-button"
        v-model="picked"
        value="TrashCan"
        :icon="getTrashCanIcon"
        aria-label="Select TrashCan"
        tooltipText="Delete drawn features"
      />
</div> 
</template>

<script setup lang="ts">
  import { onMounted, ref, computed, watch } from 'vue'
  import SrRadioButton from './SrRadioButton.vue';
  import { useMapParamsStore } from "@/stores/mapParamsStore";
  import { useMapStore } from "@/stores/mapStore.js";
  import { polyCoordsExist } from "@/composables/SrMapUtils.js";

  const mapParamsStore = useMapParamsStore();
  const mapStore = useMapStore();
  const picked = ref(mapParamsStore.drawType);
  const emit = defineEmits(['draw-buttonbox-created', 'picked-changed']);
  
  onMounted(() => {
    console.log(`Mounted SrDrawButtonBox: ${picked.value}`);
    emit('draw-buttonbox-created', picked);
  });

  watch(picked, (newValue) => {
    console.log("SrDrawButtonBox picked changed:", newValue);
    emit('picked-changed', newValue);
  });

  // Expose a reset function to the parent
  defineExpose({
    resetPicked() {
      console.log("SrDrawButtonBox resetPicked");
      picked.value = 'undefined';
      // Optionally, if you want to emit an event or do additional actions when reset
      emit('picked-changed', picked.value);
    }
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

  const getTrashCanIcon = computed(() => {
    return `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" >
  <path d="M5 6.77273H9.2M19 6.77273H14.8M9.2 6.77273V5.5C9.2 4.94772 9.64772 4.5 10.2 4.5H13.8C14.3523 4.5 14.8 4.94772 14.8 5.5V6.77273M9.2 6.77273H14.8M6.4 8.59091V15.8636C6.4 17.5778 6.4 18.4349 6.94673 18.9675C7.49347 19.5 8.37342 19.5 10.1333 19.5H13.8667C15.6266 19.5 16.5065 19.5 17.0533 18.9675C17.6 18.4349 17.6 17.5778 17.6 15.8636V8.59091M9.2 10.4091V15.8636M12 10.4091V15.8636M14.8 10.4091V15.8636" stroke="${picked.value === 'TrashCan' ? primaryColor : 'white'}"  stroke-linecap="round" stroke-linejoin="round"/>
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
