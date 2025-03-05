<template>
    <div ref="controlContainer"  class="sr-progress-spinner-control" >
        <ProgressSpinner animationDuration="1.25s" style="width: 2rem; height: 2rem;" strokeWidth="8" fill="var(--p-primary-300)" />
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, defineEmits, nextTick } from "vue";
import { Control } from "ol/control";
import ProgressSpinner from "primevue/progressspinner";
import { useMapStore } from "@/stores/mapStore";

let customControl: Control | null = null;

const mapStore = useMapStore();
const emit = defineEmits<{
    (e: 'progress-spinner-control-created', control: Control):void;
}>();
const controlContainer = ref<HTMLDivElement | null>(null);
const element = document.createElement('div');

onMounted(async () => {
    // Ensure DOM updates are completed
    await nextTick();

    element.className = 'sr-progress-spinner-control ol-unselectable ol-control';
    if(controlContainer.value){
        customControl = new Control({ element: controlContainer.value });
        emit('progress-spinner-control-created', customControl);
    }
    console.log('onMounted mapStore.isLoading:', mapStore.isLoading);
});

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null); // Clean up control on unmount
  }
});

// Watch for loading state changes and update visibility
watch(() => mapStore.isLoading, (isLoading) => {
    console.log('watch fired: mapStore.isLoading changed to', isLoading);
    if (controlContainer.value) {
        controlContainer.value.style.display = isLoading ? "flex" : "none";
    }
}, { immediate: true });

</script>

<style scoped>


</style>
