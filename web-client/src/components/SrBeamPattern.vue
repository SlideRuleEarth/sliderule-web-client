<template>
    <div class="checkbox-container">
        <Panel header="Spots" :toggleable="true" :collapsed="true">
            <div class="sr-spots-panel" v-if="computedHasScForward">
                <div class="sr-spots-panel-hdr">
                    <div class="sr-spots-title">
                        <p class="sr-p">Forward</p>
                    </div>
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
            <Divider></Divider>
            <div class="sr-spots-backward-panel" v-if="computedHasScForward">
                <div class="sr-spots-backward-panel-hdr">
                    <div class="sr-spots-title">
                        <p class="sr-p">Backward</p>
                    </div>
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
import Divider from 'primevue/divider';
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
    padding: 0rem;
    margin: 0.125rem;
}

.checkbox-row {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 0.5rem; 
    font-size: smaller;
    margin-top: 0.125rem; 
}

.checkbox-item {
    display: flex;
    align-items: center;
    justify-content: center;
    row-gap: 0.5rem; 
    column-gap: 0.25rem;
}
.sr-spots-panel {
    margin-bottom: 0.125rem;
}
.sr-spots-panel-hdr {
    padding: 0.125rem;
}
.sr-spots-panel-hdr {
    padding-top: 0rem;
    padding-bottom: 0rem;
    padding-left: 0.125rem;
    padding-right: 0.125rem;

}
.sr-spots-backward-panel {
    padding-top: 0rem;
    padding-bottom: 0rem;
    padding-left: 0.125rem;
    padding-right: 0.125rem;
    margin-top: 0rem;
}
.sr-spots-backward-panel-hdr {
    padding-top: 0rem;
    padding-bottom: 0.5rem;
    padding-left: 0.125rem;
    padding-right: 0.125rem;

}
.sr-p{
    margin: 0.25rem;
    font-size: small;
    color: var(--color-text);
}
.sr-spots-title {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0.25rem;
    font-size: small;
    border-bottom: 1px solid var(--color-border);
}
:deep(.p-panel-content) {
    padding: 0.125rem;
    margin: 0.125rem;
}
:deep(.p-divider-horizontal){
    margin-top: 1rem;
    margin-bottom: 0.25rem;
    padding: 0.125rem;
}

:deep(.p-checkbox.p-checkbox-sm) .p-checkbox-box {
    display: flex;
    /* width: 1rem;
    height: 1rem; */
    align-items: center;
    justify-content: center;
}

/* :deep(.p-checkbox.p-checkbox-sm) .p-checkbox-icon {
    font-size: 0.5rem;

} */
/* :deep(.p-checkbox-input) {
    display: flex;
    align-items: center;
    justify-content: center;
    margin:0rem;
    padding:0rem;
}
:deep(.p-checkbox-box){
    display: flex;
    align-items: center;
    justify-content: center;
    margin:0rem;
    padding:0rem;
} */
</style>
