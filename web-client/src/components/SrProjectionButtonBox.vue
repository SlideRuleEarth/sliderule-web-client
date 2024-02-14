<script setup lang="ts">
    import { onMounted, ref, watch } from 'vue'
    import SrRadioButton from './SrRadioButton.vue';
    import { useMapParamsStore } from "@/stores/mapParamsStore.js";
    import { srProjections } from '@/composables/SrProjections.js';

    const mapParamsStore = useMapParamsStore();
    const picked = ref(mapParamsStore.drawType);
    const emit = defineEmits(['projectionButtonBoxCreated', 'pickedProjectionChanged']);

    watch(picked, (newValue) => {
        emit('pickedProjectionChanged', newValue);
    });

    onMounted(() => {
      console.log("SrProjectionButtonBox onMounted");
      emit('projectionButtonBoxCreated', picked);
    });

</script>

<template>
    <div class="sr-projection-button-box">
      <SrRadioButton
        v-for="srProjection in srProjections"
        :key="srProjection.name"
        :name="`projectionButtonBox${srProjection.label}`"
        :class="`sr-${srProjection.label.toLowerCase()}-proj-button`"
        v-model="picked"
        :value="srProjection.label"
        :aria-label="`Select ${srProjection.label}`"
        :tooltipText="`${srProjection.title} Projection`"
      />
    </div>
</template>
  

<style scoped>
.sr-projection-button-box {
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
