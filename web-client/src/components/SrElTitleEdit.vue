<template>
    <div class="elevation-plot-title-editor">
        <InputText
                id="plot-title"
                v-model="globalChartStore.titleOfElevationPlot"
                class="w-full"
                placeholder="Enter plot title"
                @keydown.enter="onEditComplete"
                @blur="onEditComplete"
                />
    </div>
</template>
  
<script setup lang="ts">
    import InputText  from 'primevue/inputtext';
    import { useGlobalChartStore } from '@/stores/globalChartStore';
    import { useSrToastStore } from "@/stores/srToastStore";
    import { refreshScatterPlot } from '@/utils/plotUtils';
    

    const globalChartStore = useGlobalChartStore();

    const onEditComplete = async (event: Event) => {
        const inputElement = event.target as HTMLInputElement;
        const newValue = inputElement.value.trim();
        globalChartStore.titleOfElevationPlot = newValue; // Update the title in the store
        useSrToastStore().info('Title Updated', 'You updated the Title',2000);
        refreshScatterPlot("Title Updated"); // Refresh the plot to reflect the new title
    }

</script>
  
<style scoped>
    .elevation-plot-title-editor {
        max-width: 100%; /* Ensures the title editor does not exceed the width of its container */
        margin: .125rem 0; /* Adds some spacing around the title editor */
    }
</style>
  