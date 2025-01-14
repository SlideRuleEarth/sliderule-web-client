<template>
    <div class="symbol-size-control">
        <label for="symbolSize" class="sr-ss-label">Symbol Size</label>
        
        <div class="sr-ss-number-container">
            <InputNumber 
                v-model="symbolSize"
                :min="1"
                :max="10"
                :step="1"
                id="symbolSize"
                inputId="symbolSize"
                showButtons
                class="sr-ss-number"
            />
        </div>

    </div>
</template>
  
<script setup lang="ts">
    import { computed } from 'vue';
    import InputNumber from 'primevue/inputnumber';
    import { useChartStore } from '@/stores/chartStore';
    
    const props = defineProps<{
        /**
         * The reqIdStr identifies the portion of state in your chartStore.
         */
        reqIdStr: string;
    }>();
  
    const emit = defineEmits<{
        (event: 'update:symbolSize', value: number): void;
    }>();

    // Access Pinia store
    const chartStore = useChartStore();
  
    /**
     * 'symbolSize' is a computed property that:
     *   - reads symbolSize from the store (get)
     *   - writes symbolSize to the store (set)
     */
    const symbolSize = computed<number>({
        get() {
            return chartStore.getSymbolSize(props.reqIdStr);
        },
        set(value) {
            chartStore.setSymbolSize(props.reqIdStr, value);
            emit('update:symbolSize', value); // Emit the event with the new value
        },
    });
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
}

.sr-ss-label {
    margin: 0; /* Remove unnecessary margins */
    font-size: small; /* Adjust font size if needed */
}

.sr-ss-number-container {
    display: inline-flex; /* Allow the input to shrink-wrap */
    align-items: center;
}

:deep(.sr-ss-number) {
    width: auto; /* Ensure the input adjusts to fit its content */
    min-width: 4rem; /* Optional: Set a minimum width for usability */
}

</style>
  