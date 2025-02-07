<template>
    <div class="checkbox-container">
        <Fieldset legend="Spots" :toggleable="false" :collapsed="false">
            <!-- Row 1: Spots 1, 2, 3 -->
            <div class="checkbox-row">
                <div class="checkbox-item">
                    <Checkbox :inputId="'spot' + 1" v-model="selectedSpotReactive[props.reqIdStr]" :value="1" size="small"/>
                    <label :for="'spot' + 1">1</label>
                </div>
                <div class="checkbox-item">
                    <Checkbox :inputId="'spot' + 2" v-model="selectedSpotReactive[props.reqIdStr]" :value="2" size="small"/>
                    <label :for="'spot' + 2">2</label>
                </div>
                <div class="checkbox-item">
                    <Checkbox :inputId="'spot' + 3" v-model="selectedSpotReactive[props.reqIdStr]" :value="3" size="small"/>
                    <label :for="'spot' + 3">3</label>
                </div>
            </div>
        
            <!-- Row 2: Spots 4, 5, 6 -->
            <div class="checkbox-row">
                <div class="checkbox-item">
                    <Checkbox :inputId="'spot' + 4" v-model="selectedSpotReactive[props.reqIdStr]" :value="4" size="small"/>
                    <label :for="'spot' + 4">4</label>
                </div>
                <div class="checkbox-item">
                    <Checkbox :inputId="'spot' + 5" v-model="selectedSpotReactive[props.reqIdStr]" :value="5" size="small"/>
                    <label :for="'spot' + 5">5</label>
                </div>
                <div class="checkbox-item">
                    <Checkbox :inputId="'spot' + 6" v-model="selectedSpotReactive[props.reqIdStr]" :value="6" size="small"/>
                    <label :for="'spot' + 6">6</label>
                </div>
            </div>
        </Fieldset>
    </div>
</template>
  
<script setup lang="ts">
import Checkbox from 'primevue/checkbox';
import Fieldset from 'primevue/fieldset';
import { selectedSpotReactive } from '@/utils/plotUtils';
import { computed } from 'vue';
import { useChartStore } from '@/stores/chartStore';

const chartStore = useChartStore();

// Define props with TypeScript types
const props = withDefaults(
    defineProps<{
        reqIdStr: string;
    }>(),
    {
        reqIdStr: '0',
    }
);




const computedSelectedSpots = computed(() => chartStore.getSpots(props.reqIdStr));
</script>
    
<style scoped>
.checkbox-container {
    padding: 1rem;
}

.checkbox-row {
    display: flex;
    gap: 1rem; /* Equivalent to gap-4 */
    margin-bottom: 0.75rem; /* Equivalent to mb-3 */
}

.checkbox-item {
    display: flex;
    align-items: center;
    gap: 0.5rem; /* Adds space between the checkbox and label */
}
</style>
