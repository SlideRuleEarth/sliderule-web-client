<template>
    <div>
        <SrCustomTooltip :id="tooltipId" ref="tooltipRef" />
        <Card>
            <template #title>
                <div class="sr-card-title-center">
                    <SrElTitleEdit
                        @mouseover="handleMouseOver"
                        @mouseleave="handleMouseLeave"
                    />
                </div>
            </template>

            <template #content>
                <div class="sr-highlighted-track-details">
                    <p class="sr-highlighted-track-details-1">{{ detailsLine1 }}</p>
                    <p v-if="detailsLine2" class="sr-highlighted-track-details-2">{{ detailsLine2 }}</p>
                </div>
                <Fieldset legend="Advanced Filter Control" class="sr-filter-panel" toggleable :collapsed="true">
                    <SrWhereClause />
                    <div class="sr-cycles-legend-panel">
                        <Button
                            class="sr-reset-btn sr-glow-button"
                            icon="pi pi-refresh"
                            variant="text"
                            rounded
                            label="Reset"
                            @click="handleValueChange"
                            size="small"
                        />

                        <div class="sr-select-boxes">
                            <div class="sr-rgt-y-atc">
                                <div class="sr-select-box" v-if="notAtl13xTimeSeries">
                                    <SrRgtSelect :rgtLabel="rgtLabel" />
                                </div>
                            </div>

                            <!-- Cycle/Orbit select can be customized via prop/slot -->
                            <component
                                :is="cycleSelectComponent"
                                v-bind="cycleSelectProps"
                            >
                                <slot name="cycle-select" />
                            </component>
                        </div>

                        <div class="sr-beam-y-atc" >
                            <div>
                                <component :is="beamPatternComponent" :reqIdStr="recTreeStore.selectedReqIdStr" />
                            </div>

                            <div v-if="showYAtc && notAtl13xTimeSeries">
                                <component :is="yAtcComponent" />
                            </div>

                            <!-- Extra right-column content if needed -->
                            <slot name="right-col" />
                        </div>
                    </div>
                </Fieldset>
            </template>
        </Card>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useActiveTabStore } from '@/stores/activeTabStore';
import { resetFilterUsingSelectedRec } from '@/utils/SrMapUtils';
import { callPlotUpdateDebounced } from '@/utils/plotUtils';
import SrRgtSelect from '@/components/SrRgtSelect.vue';

import Button from 'primevue/button';
import Fieldset from 'primevue/fieldset';
import Card from 'primevue/card';
import SrElTitleEdit from '@/components/SrElTitleEdit.vue';
import SrCustomTooltip from '@/components/SrCustomTooltip.vue';
import SrWhereClause from '@/components/SrWhereClause.vue';
import { createLogger } from '@/utils/logger';

const logger = createLogger('SrFilterCntrlBase');

// Props that control the small differences between ICESat-2 and GEDI
const props = defineProps<{
    tooltipId: string;                       // e.g. "fltr_icesat2" | "fltr_gedi"
    rgtLabel: string;                        // e.g. "Rgts" | "Tracks"
    beamPatternComponent: any;               // component to render on left of bottom row
    showYAtc?: boolean;                      // show y_atc control?
    yAtcComponent?: any;                     // component for y_atc control (if shown)
    cycleSelectComponent?: any;              // defaults to SrCycleSelect
    cycleSelectProps?: Record<string, any>;  // e.g. { label: "Orbits" }
    detailsLine1: string;                    // first line of “highlighted details”
    detailsLine2?: string;                   // optional second line
}>();

const recTreeStore = useRecTreeStore();
const activeTabStore = useActiveTabStore();
const tooltipRef = ref();
const computedApi = computed(() => recTreeStore.selectedApi);
const notAtl13xTimeSeries = computed(() =>
    (computedApi.value === 'atl13x') ? ((activeTabStore.isActiveTabTimeSeries) ?  false : true) : true
);


function handleMouseOver(e: MouseEvent) {
    tooltipRef.value?.showTooltip?.(
        e,
        'This is the title of the elevation plot. You can edit it. It will reset when you reload the page'
    );
}

function handleMouseLeave() {
    tooltipRef.value?.hideTooltip?.();
}

function handleValueChange() {
    const reqId = recTreeStore.selectedReqIdStr;
    if (reqId) {
        void nextTick(async () => {
            resetFilterUsingSelectedRec();
            await callPlotUpdateDebounced('SrFilterCntrlBase:handleValueChange - RGT');
        });
    } else {
        logger.warn('handleValueChange - RGT reqId is undefined');
    }
}
</script>

<style scoped>
/* All your shared styles, copied once */
.sr-cycles-legend-panel{
    display: flex;
    flex-direction: column;
    justify-content:space-between;
    align-items:center;
    margin: 0rem;
    padding: 0rem;
    width: auto;
}
.sr-header {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    font-size: small;
    font-weight: bold;
    color: var(--color-text);
}
.sr-beam-y-atc {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
    width: auto;
    margin-top:0.5rem;
}
.sr-card-title-center {
    display: flex;
    justify-content: center;
    align-items: center;
}
.sr-highlighted-track-details {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: auto;
    font-size: small;
    color: var(--color-text);
    background-color: var(--color-bg);
    border-radius: 0.25rem;
}
.sr-highlighted-track-details-1 {
    margin-block-start: 0rem;
    margin-block-end: 0.125rem;
    font-size: small;
}
.sr-highlighted-track-details-2 {
    margin-block-start: 0rem;
    margin-block-end: 0.25rem;
}
.sr-filter-panel { min-width: 26rem; }
.sr-filter-option {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1rem; padding: 0.5rem; margin: 0.5rem; width: fit-content; min-width: 30rem;
}
.sr-select-lists {
    display: flex; flex-direction: column; justify-content:center; align-items:flex-start;
    margin: 0.5rem; padding: 0.5rem; width: auto; max-width: 10rem;
}
.sr-select-boxes {
    display: flex; flex-direction: row; justify-content: space-around; align-items: flex-start; width: auto;
}
.sr-select-box{
    display: flex; flex-direction: column; justify-content:center; align-items:flex-start;
    margin: 0.25rem; padding: 0.25rem; width: auto; max-width: 10rem;
}
.sr-y-atc-boxs{ display: flex; flex-direction: column; justify-content:flex-start; align-items:center; }
.sr-select-box-hdr{
    display: flex; justify-content:center; align-items:center;
    margin: 0.125rem; padding: 0.125rem; width: auto; max-width: 10rem;
    font-size:medium; font-weight: bold; color: var(--color-text); background-color: var(--color-bg);
    border-radius: 0.25rem;
}
/* primevue deep adjustments */
:deep(.p-listbox-list-container) { width: 100%; min-width: 5rem; max-width: 16rem; max-height: 10rem; margin: 0.25rem; }
:deep(.p-listbox-option) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0.25rem; }
:deep(.p-panel-header), :deep(.p-card-content), :deep(.p-card-title) { justify-content: center; align-items: center; }
:deep(.p-panel-content) { justify-content: center; padding: 0.125rem; margin: 0.125rem; }
:deep(.sr-photon-cloud .p-card-body){ justify-content: center; align-items: center; }
:deep(.p-listbox .p-listbox-list .p-listbox-option.p-listbox-option-selected){
    color: var(--p-primary-color); font-weight: bold;
}
</style>
