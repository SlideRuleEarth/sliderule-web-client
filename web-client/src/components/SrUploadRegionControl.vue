<!-- SrUploadRegionControl.vue -->
<template>
  <!-- Wrapper that OL will style; global CSS targets .sr-control -->
  <div
    ref="containerEl"
    class="ol-control ol-unselectable sr-control sr-upload-region-control"
    role="group"
    aria-label="Upload Region control"
  >
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
  /** Parent (SrMap.vue) listens and calls map.addControl(control) */
  (e: 'upload-region-control-created', control: Control): void;
}>();

const containerEl = ref<HTMLDivElement | null>(null);
let control: Control | null = null;

onMounted(() => {
  if (!containerEl.value) return;
  // Create the OpenLayers control using this component’s root element
  control = new Control({ element: containerEl.value });
  emit('upload-region-control-created', control);
});

onBeforeUnmount(() => {
  // Detach from any map that might be holding it
  control?.setMap?.(null);
  control = null;
});
</script>

<!-- No scoped styles here; all styling comes from your global CSS:
     .ol-control.sr-control { ...neutralize OL styles... }
     .ol-control.sr-control .sr-glow-button { ... }
-->
