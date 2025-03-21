<template>
    <div class="sr-rec-req-display-panel">
        <Button 
            icon="pi pi-eye" 
            :label="props.label"
            class="sr-glow-button"
            @click="openParmsDialog(reqParms)"
            @mouseover="tooltipRef?.showTooltip($event, props.tooltipText)"
            @mouseleave="tooltipRef?.hideTooltip"
            variant="text"
            rounded
            :disabled="props.insensitive"
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
    import { ref,onMounted } from "vue";
    import Button from "primevue/button";
    import { db } from "@/db/SlideRuleDb";
    import SrJsonDisplayDialog from "./SrJsonDisplayDialog.vue";
    import SrCustomTooltip from "./SrCustomTooltip.vue";

    const props = withDefaults(
        defineProps<{
            reqId: number;
            label: string;
            insensitive?: boolean;
            tooltipText?: string;
        }>(),
        {
            reqId: 0,
            label: 'Show Req Parameters',
            insensitive: false,
            tooltipText: '',
            tooltipUrl: '',
            labelFontSize: 'small',
            labelOnRight: false
        }
    );

    const showParmsDialog = ref(false);
    const reqParms = ref<string>('');
    const curAPI = ref<string>('');
    const tooltipRef = ref();

    onMounted(async () => {
        if(props.reqId) {
            curAPI.value = await db.getFunc(props.reqId);
            const p = await db.getReqParams(props.reqId);
            reqParms.value = JSON.stringify(p, null, 2);
        } else {
            console.log('SrRecReqDisplay onMounted: no reqId');
        }
    });
    // Open the Parms dialog
    function openParmsDialog(params: string | object) {
        if (typeof params === 'object') {
            reqParms.value = JSON.stringify(params, null, 2);
        } else {
            reqParms.value = params;
        }
        showParmsDialog.value = true;
    }

  </script>
  
  <style scoped>
  /* Style your button and component here */
  .sr-rec-req-display-panel {
  }

.sr-rec-req-display-parms {
    position: relative;
    margin-top: 0rem;
    display: flex;
    justify-content: column;
    max-height: 15rem;
    max-width: 15rem;
    min-height: 10rem;
    overflow-y: auto;
    overflow-x: auto;
    width: 100%;
    text-overflow: clip;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* Internet Explorer 10+ */
}



</style>
  