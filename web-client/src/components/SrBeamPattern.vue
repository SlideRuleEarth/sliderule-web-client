<template>
    <div class="checkbox-container">
        <Panel header="Spots" :toggleable="true" :collapsed="false">
            <div class="sr-spots-panel" v-if="computedHasScForward">
                <div class="sr-spots-panel-hdr">
                    <h5>Forward</h5>
                    <!-- Row 1: Spots 6, 4, 2 -->
                    <div class="checkbox-row">
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 6" v-model="selectedSpotReactive[props.reqIdStr]" :value="6" size="small"/>
                            <label :for="'spot' + 6">6</label>
                        </div>
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 4" v-model="selectedSpotReactive[props.reqIdStr]" :value="4" size="small"/>
                            <label :for="'spot' + 4">4</label>
                        </div>
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 2" v-model="selectedSpotReactive[props.reqIdStr]" :value="2" size="small"/>
                            <label :for="'spot' + 2">2</label>
                        </div>
                    </div>
                    
                    <!-- Row 2: Spots 5, 3, 1 -->
                    <div class="checkbox-row">
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 5" v-model="selectedSpotReactive[props.reqIdStr]" :value="5" size="small"/>
                            <label :for="'spot' + 5">5</label>
                        </div>
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 3" v-model="selectedSpotReactive[props.reqIdStr]" :value="3" size="small"/>
                            <label :for="'spot' + 3">3</label>
                        </div>
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 1" v-model="selectedSpotReactive[props.reqIdStr]" :value="1" size="small"/>
                            <label :for="'spot' + 1">1</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="sr-spots-panel" v-if="computedHasScForward">
                <div class="sr-spots-panel-hdr">
                    <h5>Backward</h5>
                    <!-- Row 1: Spots 1, 3, 5 -->
                    <div class="checkbox-row">
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 1" v-model="selectedSpotReactive[props.reqIdStr]" :value="1" size="small"/>
                            <label :for="'spot' + 1">1</label>
                        </div>
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 3" v-model="selectedSpotReactive[props.reqIdStr]" :value="3" size="small"/>
                            <label :for="'spot' + 3">3</label>
                        </div>
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 5" v-model="selectedSpotReactive[props.reqIdStr]" :value="5" size="small"/>
                            <label :for="'spot' + 5">5</label>
                        </div>
                    </div>

                    <!-- Row 2: Spots 2, 4, 6 -->
                    <div class="checkbox-row">
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 2" v-model="selectedSpotReactive[props.reqIdStr]" :value="2" size="small"/>
                            <label :for="'spot' + 2">2</label>
                        </div>
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 4" v-model="selectedSpotReactive[props.reqIdStr]" :value="4" size="small"/>
                            <label :for="'spot' + 4">4</label>
                        </div>
                        <div class="checkbox-item">
                            <Checkbox :inputId="'spot' + 6" v-model="selectedSpotReactive[props.reqIdStr]" :value="6" size="small"/>
                            <label :for="'spot' + 6">6</label>
                        </div>
                    </div>
                </div>
            </div>
        </Panel>
    </div>
    <div v-if="!computedHasScForward && !computedHasScBackward">
        <p>No SC_Orient set?</p>
    </div>
</template>

  
<script setup lang="ts">
import Checkbox from 'primevue/checkbox';
import Panel from 'primevue/panel';
import { selectedSpotReactive } from '@/utils/plotUtils';
import { computed } from 'vue';
import { useGlobalChartStore } from '@/stores/globalChartStore';

const globalChartStore = useGlobalChartStore();

// Define props with TypeScript types
const props = withDefaults(
    defineProps<{
        reqIdStr: string;
    }>(),
    {
        reqIdStr: '0',
    }
);

const computedHasScForward = computed(() => globalChartStore.hasScForward());
const computedHasScBackward = computed(() => globalChartStore.hasScBackward());   
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
.sr-spots-panel {
    margin-bottom: 1rem;
}
.sr-spots-panel-hdr {
    padding: 1rem;
    border-bottom: 1px solid var(--color-border);
}
</style>
