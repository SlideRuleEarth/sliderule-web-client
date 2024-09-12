<script setup lang="ts">

    import SrMenuInput from "@/components/SrMenuInput.vue";
    import SrAdvOptAccordion from "@/components/SrAdvOptAccordion.vue";
    import { onMounted, watch } from 'vue';
    import { useMapStore } from '@/stores/mapStore';
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import SrReqDisplay from '@/components/SrReqDisplay.vue';
    import SrRunControl from "@/components/SrRunControl.vue";

    const reqParamsStore = useReqParamsStore();
    const mapStore = useMapStore();
    
    onMounted(async () => {
        //console.log('SrAdvOptSidebar onMounted totalTimeoutValue:',reqParamsStore.totalTimeoutValue);
        mapStore.isAborting = false;
    });

    watch(() => useReqParamsStore().missionValue,(newValue,oldValue) => {
        //console.log(`missionValue changed from ${oldValue} to ${newValue}`);
        if (newValue.value === 'ICESat-2') {
            useReqParamsStore().iceSat2SelectedAPI = useReqParamsStore().iceSat2APIsItems[0]; // Reset to default when mission changes
            reqParamsStore.asset ='icesat2';
        } else if (newValue.value === 'GEDI') {
            useReqParamsStore().gediSelectedAPI = useReqParamsStore().gediAPIsItems[0]; // Reset to default when mission changes
            reqParamsStore.asset ='gedi';
        }
    });

</script>
<template>
    <div class="sr-adv-option-sidebar-container">
        <SrRunControl />
        <div class="sr-adv-option-sidebar-options">
            <SrMenuInput
                v-model="useReqParamsStore().missionValue"
                label="Mission:"
                :menuOptions="useReqParamsStore().missionItems"
                tooltipText="Select a mission to determine which APIs are available."
                tooltipUrl="https://slideruleearth.io/web/rtd/index.html" 
            />
            <SrMenuInput
                v-model="useReqParamsStore().iceSat2SelectedAPI"
                v-if="useReqParamsStore().missionValue.value === 'ICESat-2'"
                label="ICESat-2 API:"
                :menuOptions="useReqParamsStore().iceSat2APIsItems"
                :initial-value="useReqParamsStore().iceSat2APIsItems[0]" 
                tooltipText="Select an API to use for the selected mission."
                tooltipUrl="https://slideruleearth.io/web/rtd/api_reference/icesat2.html#icesat2"
            />
            <SrMenuInput
                v-model="useReqParamsStore().gediSelectedAPI"
                v-if="useReqParamsStore().missionValue.value === 'GEDI'"
                label="GEDI API:"
                :menuOptions="useReqParamsStore().gediAPIsItems"
                :initial-value="useReqParamsStore().gediAPIsItems[0]" 
                tooltipText="Select an API to use for the selected mission."
                tooltipUrl="https://slideruleearth.io/web/rtd/api_reference/gedi.html#gedi"
            />
            <div>
                <SrReqDisplay />
            </div>
        </div>  
        <SrAdvOptAccordion
            title="Options"
            ariaTitle="advanced-options"
            :mission="useReqParamsStore().missionValue"
            :iceSat2SelectedAPI="useReqParamsStore().iceSat2SelectedAPI"
            :gediSelectedAPI="useReqParamsStore().gediSelectedAPI"
        />
    </div>
</template>
<style scoped>
    .sr-adv-option-sidebar-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
    }
    .sr-adv-option-sidebar-options {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

</style>