<template>
    <div v-if="!computedHasScForward && !computedHasScBackward">
        <p>No SC_Orient set?</p>
    </div>
    <div class="sr-sc-orient-panel">
        <div class="checkbox-item">
            <Checkbox :inputId="'sc_orient' + SC_BACKWARD" v-model="selectedScOrientsReactive[props.reqIdStr]" :value="SC_BACKWARD" size="small"/>
            <label :for="'sc_orient' + SC_BACKWARD">Backward</label>
        </div>
        <div class="checkbox-item">
            <Checkbox :inputId="'sc_orient' + SC_FORWARD" v-model="selectedScOrientsReactive[props.reqIdStr]" :value="SC_FORWARD" size="small"/>
            <label :for="'sc_orient' + SC_FORWARD">Forward</label>
        </div>
    </div>
    <div class="checkbox-container">
        <Panel header="Spots/Beams" :toggleable="true" :collapsed="false">
            <!-- props.reqIdStr:{{ props.reqIdStr }}
            cmp:{{ selectedScOrientsReactive[props.reqIdStr] }} -->
            <div class="sr-spots-panel" v-if="computedHasScForward">
                <div class="sr-spots-panel-hdr">
                    <div class="sr-spots-title">
                        <p class="sr-p">Forward</p>
                    </div>
                    <!-- Row 1: Spots 6, 4, 2 -->
                    <div class="checkbox-row">
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="6"
                                label="GT1L" 
                            />
                        </div>
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="4"
                                label="GT2L"
                            />
                        </div>
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="2"
                                label="GT3L"
                            />
                        </div>
                    </div>
                    
                    <!-- Row 2: Spots 5, 3, 1 -->
                    <div class="checkbox-row">
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="5"
                                label="GT1R"
                            />
                        </div>
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="3"
                                label="GT2R"
                            />
                        </div>
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="1"
                                label="GT3R"
                            />
                        </div>
                    </div>
                </div>
            </div>
            <Divider></Divider>
            <div class="sr-spots-panel" v-if="computedHasScBackward">
                <div class="sr-spots-backward-panel-hdr">
                    <div class="sr-spots-title">
                        <p class="sr-p">Backward</p>
                    </div>
                    <!-- Row 1: Spots 1, 3, 5 -->
                    <div class="checkbox-row">
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="1"
                                label="GT1L"
                            />
                        </div>
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="3"
                                label="GT2L"
                            />
                        </div>
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="5"
                                label="GT3L"
                            />
                        </div>
                    </div>

                    <!-- Row 2: Spots 2, 4, 6 -->
                    <div class="checkbox-row">
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="2" 
                                label="GT1R"
                                />
                        </div>
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="4"
                                label="GT2R"
                            />
                        </div>
                        <div class="checkbox-item">
                            <SrSpotCheckbox 
                                v-model="globalChartStore.selectedSpots" 
                                :digit="6"
                                label="GT3R"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Panel>
    </div>   
</template>

  
<script setup lang="ts">
import Panel from 'primevue/panel';
import Divider from 'primevue/divider';
import Checkbox from 'primevue/checkbox';
import SrSpotCheckbox from '@/components/SrSpotCheckbox.vue';
import { selectedScOrientsReactive } from '@/utils/plotUtils';
import { computed } from 'vue';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { SC_BACKWARD,SC_FORWARD } from '@/sliderule/icesat2';

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
.sr-sc-orient-panel {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 0.5rem; 
    font-size: smaller;
    margin-top: 0.125rem;
    margin-bottom: 0.125rem; 
}
/* :deep(.p-panel-content) {
    padding: 0.125rem;
    margin: 0.125rem;
} */
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
