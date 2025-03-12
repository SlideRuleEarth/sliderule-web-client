<template>
    <div 
        ref="controlContainer"  
        class="sr-progress-spinner-control" 
    >
        <ProgressSpinner 
            animationDuration="1.25s" 
            style="width: 2rem; height: 2rem;" 
            strokeWidth="8" 
            fill="var(--p-primary-300)" 
        />
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from "vue";
import { Control } from "ol/control";
import ProgressSpinner from "primevue/progressspinner";
import { useAnalysisMapStore } from "@/stores/analysisMapStore";

const props = withDefaults(
    defineProps<{
        selectedReqId: number;
    }>(),
    {
        selectedReqId: 0,
    }
);

const analysisMapStore = useAnalysisMapStore();
let customControl: Control | null = null;

const computedIsLoading = computed(() => {
    return analysisMapStore.getPntDataByReqId(props.selectedReqId.toString()).isLoading;
});

const emit = defineEmits<{
    (e: 'progress-spinner-control-created', control: Control):void;
}>();
const controlContainer = ref<HTMLDivElement | null>(null);

onMounted(async () => {
    // Ensure DOM updates are completed

    if(controlContainer.value){
        customControl = new Control({ element: controlContainer.value });
        emit('progress-spinner-control-created', customControl);
    }
    console.log('onMounted mapStore.isLoading:', analysisMapStore.getPntDataByReqId);
});

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null); // Clean up control on unmount
  }
});

// Watch for loading state changes and update visibility
watch(
  computedIsLoading,
  (isLoading) => {
    console.log("watch fired: mapStore.isLoading changed to", isLoading);
    if (controlContainer.value) {
      controlContainer.value.style.display = isLoading ? "flex" : "none";
    }
  },
  { immediate: true }
);

</script>

<style scoped>


</style>
