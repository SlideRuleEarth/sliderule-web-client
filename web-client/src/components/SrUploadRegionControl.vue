<!-- SrUploadRegionControl.vue -->
<template>
  <!-- The control DOM; SrMap will add the created control to the map -->
  <div ref="containerEl" class="ol-control sr-upload-region-control">
    <SrUploadRegion :iconOnly="iconOnly" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import Control from 'ol/control/Control';
import SrUploadRegion from '@/components/SrUploadRegion.vue';

const props = defineProps<{
  /** Show the trigger as icon-only (passed to SrUploadRegion) */
  iconOnly?: boolean;
}>();

const emit = defineEmits<{
  /** Follows your pattern: parent (SrMap.vue) listens and calls map.addControl(...) */
  (e: 'upload-region-control-created', control: Control): void;
}>();

const containerEl = ref<HTMLDivElement | null>(null);
let control: Control | null = null;

onMounted(() => {
  if (!containerEl.value) return;
  // Build the OpenLayers control with this component’s root element
  control = new Control({ element: containerEl.value });
  emit('upload-region-control-created', control);
});

onBeforeUnmount(() => {
  // Detach from any map that might be holding it
  control?.setMap?.(null);
  control = null;
});
</script>

<style scoped>
/* Keep it lightweight; position in SrMap.vue like your other controls */
.sr-upload-region-control {
  pointer-events: auto; /* allow clicks inside the control */
}
</style>
