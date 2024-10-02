<script setup lang="ts">

    import SrMenu from "@/components/SrMenu.vue";
    import SrAdvOptAccordion from "@/components/SrAdvOptAccordion.vue";
    import { onMounted } from 'vue';
    import { useMapStore } from '@/stores/mapStore';
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import SrReqDisplay from '@/components/SrReqDisplay.vue';

    const mapStore = useMapStore();
    
    onMounted(async () => {
        //console.log('SrAdvOptSidebar onMounted totalTimeoutValue:',reqParamsStore.totalTimeoutValue);
        mapStore.isAborting = false;
    });

</script>
<template>
    <div class="sr-adv-option-sidebar">
        <div class="sr-adv-option-sidebar-header">
            <SrMenu
                label="Mission:"
                v-model="useReqParamsStore().missionValue"
                :menuOptions="useReqParamsStore().missionItems"
                :getSelectedMenuItem="useReqParamsStore().getMissionValue"
                :setSelectedMenuItem="useReqParamsStore().setMissionValue"
                tooltipText="Select a mission to determine which APIs are available."
                tooltipUrl="https://slideruleearth.io/web/rtd/index.html" 
            />
            <SrMenu
                label="ICESat-2 API:"
                v-model="useReqParamsStore().iceSat2SelectedAPI"
                v-if="useReqParamsStore().getMissionValue() === 'ICESat-2'"
                :menuOptions="useReqParamsStore().iceSat2APIsItems"
                :getSelectedMenuItem="useReqParamsStore().getIceSat2API"
                :setSelectedMenuItem="useReqParamsStore().setIceSat2API"
                :defaultOptionIndex="0"
                tooltipText="Select an API to use for the selected mission."
                tooltipUrl="https://slideruleearth.io/web/rtd/api_reference/icesat2.html#icesat2"
            />
            <SrMenu
                label="GEDI API:"
                v-model="useReqParamsStore().gediSelectedAPI"
                v-if="useReqParamsStore().getMissionValue() === 'GEDI'"
                :menuOptions="useReqParamsStore().gediAPIsItems"
                :getSelectedMenuItem="useReqParamsStore().getGediAPI"
                :setSelectedMenuItem="useReqParamsStore().setGediAPI"
                :defaultOptionIndex="0"
                tooltipText="Select an API to use for the selected mission."
                tooltipUrl="https://slideruleearth.io/web/rtd/api_reference/gedi.html#gedi"
            />
        </div>
        <div class="sr-adv-option-sidebar-container">
            <div class="sr-req-display-row">
                <SrReqDisplay />
            </div>
            <SrAdvOptAccordion
                title="Options"
                ariaTitle="advanced-options"
                :mission="useReqParamsStore().getMissionValue()"
                :iceSat2SelectedAPI="useReqParamsStore().getIceSat2API()"
                :gediSelectedAPI="useReqParamsStore().getGediAPI()"
            />
        </div>
    </div>
</template>
<style scoped>

.sr-adv-option-sidebar {
    display: flex;
    flex-direction: column;
    height: 100vh; /* Ensure the sidebar takes up the full viewport height */
    margin-top: auto;
}
.sr-adv-option-sidebar-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    overflow-y: auto;
    width: 100%;
}

.sr-adv-option-sidebar-header {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 1rem;
}

.sr-req-display-row {
    width: 100%;
}
</style>