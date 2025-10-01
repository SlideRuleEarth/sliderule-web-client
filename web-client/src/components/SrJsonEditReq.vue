<template>
    <div class="sr-req-display-panel">
        <SrCustomTooltip ref="tooltipRef" id="recEditTooltip"/>
        <Button 
            icon="pi pi-user-edit" 
            :label="props.label"
            class="sr-glow-button"
            id="sr-req-display-btn"
            @click="openParmsDialog()"
            @mouseover="tooltipRef?.showTooltip($event, props.tooltipText)"
            @mouseleave="tooltipRef?.hideTooltip"
            variant="text"
            rounded
        ></Button>
        <SrJsonEditDialog
            v-model="reqParamsStore.showParamsDialog"
            :zodSchema="ICESat2RequestSchema"
            :title="`endpoint = ${curAPI}`"
            width="80vw"
        />
       
    </div>
  </template>
  
<script setup lang="ts">
    import { computed, ref } from "vue";
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import SrJsonEditDialog from "./SrJsonEditDialog.vue";
    import SrCustomTooltip from "./SrCustomTooltip.vue";
    import Button from "primevue/button";
    import { ICESat2RequestSchema } from '@/zod/ICESat2Schemas';

    // Props
    const props = defineProps({
        label: {
            type: String,
            default: "Edit JSON Request",
        },
        tooltipText: {
            type: String,
            default: "Import JSON request parameter from a file or clipboard",
        },
    });
    const tooltipRef = ref();
    const curAPI = computed(() => reqParamsStore.getCurAPIStr());
  
    const reqParamsStore = useReqParamsStore();
    
      
    // Open the Parms dialog
    function openParmsDialog() {
        reqParamsStore.showParamsDialog = true;
    }

</script>
  
  
<style scoped>
.sr-req-display-panel {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0;
}

</style>
