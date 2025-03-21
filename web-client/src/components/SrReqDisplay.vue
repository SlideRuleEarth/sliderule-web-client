<template>
    <div class="sr-req-display-panel">
        <Button 
            icon="pi pi-eye" 
            :label="props.label"
            class="sr-glow-button"
            @click="openParmsDialog(reqParms)"
            @mouseover="tooltipRef?.showTooltip($event, props.tooltipText)"
            @mouseleave="tooltipRef?.hideTooltip"
            variant="text"
            rounded
        ></Button>
        <SrJsonDisplayDialog
            v-model:visible="showParmsDialog"
            :json-data="reqParms"
            :title="`endpoint = ${curAPI}`"
            width="50vw"
        />
        <SrCustomTooltip ref="tooltipRef"/>
       
    </div>
  </template>
  
<script setup lang="ts">
    import { computed, ref } from "vue";
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import { useAutoReqParamsStore } from "@/stores/reqParamsStore";
    import SrJsonDisplayDialog from "./SrJsonDisplayDialog.vue";
    import SrCustomTooltip from "./SrCustomTooltip.vue";
    import Button from "primevue/button";
  
    // Props
    const props = defineProps({
        label: {
            type: String,
            default: "Show Request Parameters",
        },
        isForPhotonCloud: {
            type: Boolean,
            default: false,
        },
        tooltipText: {
            type: String,
            default: "Show or hide the request parameters",
        },
    });
    const tooltipRef = ref();
    const showParmsDialog = ref(false);
    const curAPI = computed(() => reqParamsStore.getCurAPIStr());
  
    let reqParamsStore;
    if(props.isForPhotonCloud) {
        reqParamsStore = useAutoReqParamsStore();
    } else {
        reqParamsStore = useReqParamsStore();
    }
      
    const reqParms = computed(() => {
        return JSON.stringify(reqParamsStore.getAtlxxReqParams(0), null, 2);
    });
    // Open the Parms dialog
    function openParmsDialog(params: string | object) {
        showParmsDialog.value = true;
    }
</script>
  
  
<style scoped>
.sr-req-display-panel {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0;
}

:deep(.sr-glow-button:hover) {
    border-width: 1px;
    border-color: var(--primary-color);
    box-shadow: 0 0 12px var(--p-button-primary-border-color), 0 0 20px var(--p-button-primary-border-color);
    transition: box-shadow 0.3s ease;
}

</style>
