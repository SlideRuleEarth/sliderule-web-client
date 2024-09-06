<script setup lang="ts">

    import Button from 'primevue/button';
    import { onMounted } from 'vue';
    import ProgressSpinner from 'primevue/progressspinner';
    import { useMapStore } from '@/stores/mapStore';
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import { useRequestsStore } from "@/stores/requestsStore";
    import { useCurReqSumStore } from '@/stores/curReqSumStore';
    import ProgressBar from 'primevue/progressbar';
    import { processRunSlideRuleClicked } from  "@/utils/workerDomUtils";
    import { processAbortClicked } from  "@/utils/workerDomUtils";    
    import { useSrToastStore } from "@/stores/srToastStore";

    const reqParamsStore = useReqParamsStore();
    const requestsStore = useRequestsStore();
    const mapStore = useMapStore();
 
    onMounted(async () => {
        console.log('SrGenUserSidebar onMounted totalTimeoutValue:',reqParamsStore.totalTimeoutValue);
        mapStore.isAborting = false;
        useSrToastStore().info('Helpful Advice',"1) Select a geographic region of about several square miles.    Then:\n 2) Click 'Run SlideRule' to start the process");

    });

    function runSlideRuleClicked() {
        console.log('runSlideRuleClicked');
        reqParamsStore.initParmsForGenUser();
        processRunSlideRuleClicked();
    }

    function abortClicked() {
        console.log('abortClicked');
        processAbortClicked();
    }

</script>
<template>
    <div class="sr-gen-user-sidebar-container">
        <div class="sr-gen-user-sidebar-options">

            <div class="button-spinner-container">
                <Button label="Run SlideRule" @click="runSlideRuleClicked" :disabled="mapStore.isLoading"></Button>
                <Button label="Abort" @click="abortClicked" v-if:="mapStore.isLoading" :disabled="mapStore.isAborting"></Button>
                <ProgressSpinner v-if="mapStore.isLoading" animationDuration="1.25s" style="width: 3rem; height: 3rem"/>
            </div>
            <div class="sr-progressbar-panel ">
                <span class="sr-svr-msg">{{requestsStore.getConsoleMsg()}}</span>
                <div class="sr-progressbar">
                    <span></span>
                    <ProgressBar v-if="mapStore.isLoading" :value="useCurReqSumStore().getPercentComplete()" />
                </div>  
            </div>
        </div>  
    </div>
</template>
<style scoped>
    .sr-gen-user-sidebar-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
    }
    .sr-gen-user-sidebar-options {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    .button-spinner-container {
        display: flex;
        align-items: center; /* This will vertically center the spinner with the button */
        justify-content: center; /* Center the content horizontally */
    }
    .runtest-sr-button {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        margin: 2rem;
    }

    .sr-svr-msg {
        display: block;
        font-size: x-small;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 15rem; 
        justify-content:center;
        align-items: left;
    } 

    .sr-progressbar-panel {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        margin: 0.25rem;
        padding: 0.25rem;
        overflow-x: auto;
        overflow-y: hidden;
        max-width: 15rem;
        min-width: 15rem;
        height: 3rem;
    }

    .sr-progressbar {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: left;
        font-size: x-small;
        min-width: 15rem;
    } 
</style>