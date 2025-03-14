<template>
    <div class="symbol-size-control">
        <label for="symbolSize" class="sr-ss-label">Symbol Size</label>
        
        <div class="sr-ss-number-container">
            <InputNumber 
                v-model="symbolStore.size[props.reqIdStr]"
                size="small"
                :min="1"
                :max="10"
                :step="1"
                id="symbolSize"
                inputId="symbolSize"
                showButtons
                class="sr-ss-number"
                @update:modelValue="handleUpdate"
            />
        </div>

    </div>
</template>
  
<script setup lang="ts">
    import InputNumber from 'primevue/inputnumber';
    import { useSymbolStore } from '@/stores/symbolStore';
    import { refreshScatterPlot } from '@/utils/plotUtils';

    const symbolStore = useSymbolStore();

    const props = defineProps<{
        /**
         * The reqIdStr identifies the portion of state in your chartStore.
         */
        reqIdStr: string;
    }>();

async function handleUpdate() {
    // This function is called whenever the input value changes
    // You can add any additional logic here if needed
    // For example, you might want to log the new value or perform some validation
    console.log(`Symbol size updated to: ${symbolStore.size[props.reqIdStr]}`);
    await refreshScatterPlot("user changed symbol size");
}

</script>
  
<style scoped>
.symbol-size-control {
    display: inline-flex; /* Allow the container to shrink-wrap its content */
    flex-direction: column;
    justify-content: center;
    align-items: flex-start; /* Align content to the left */
    gap: 0.5rem; /* Add spacing between elements */
    width: auto; /* Let the container size itself based on the content */
    padding: 0.5rem; /* Optional: Add some padding for spacing */
    width: 6rem;
}

.sr-ss-label {
    margin: 0; /* Remove unnecessary margins */
    font-size: small; /* Adjust font size if needed */
}

.sr-ss-number-container {
    display: inline-flex; /* Allow the input to shrink-wrap */
    align-items: center;
    width: 7.5rem;
}
:deep(.p-inputnumber-input){
    width:7.5rem;
}

:deep(.sr-ss-number) {
    width: auto; /* Ensure the input adjusts to fit its content */
    min-width: 4rem; /* Optional: Set a minimum width for usability */
}

</style>
  