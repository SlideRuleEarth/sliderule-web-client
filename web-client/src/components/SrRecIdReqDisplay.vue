<template>
    <div class="sr-rec-req-display-panel">
        <div class="sr-rec-req-display-panel-header"> 
            <SrCheckbox
                v-model="showReqParms"
                :label=props.label
                :insensitive=props.insensitive
                :tooltipText=props.tooltipText
                :tooltipUrl=props.tooltipUrl
                :labelFontSize=props.labelFontSize
                :labelOnRight=props.labelOnRight
            />
        </div>
        <div class="sr-rec-req-display-parms" v-if="showReqParms">
            <div><pre><code>endpoint = {{ curAPI }}<br>{{ reqParms }}</code></pre></div>
        </div>
    </div>
  </template>
  
  <script setup lang="ts">
    import { ref,onMounted } from "vue";
    import SrCheckbox from "./SrCheckbox.vue";
    import { db } from "@/db/SlideRuleDb";
    const props = withDefaults(
        defineProps<{
            reqId: number;
            label: string;
            insensitive?: boolean;
            tooltipText?: string;
            tooltipUrl?: string;
            labelFontSize?: string;
            labelOnRight?: boolean;
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


    const showReqParms = ref(false);
    const reqParms = ref<string>('');
    const curAPI = ref<string>('');;

    onMounted(async () => {
        if(props.reqId) {
            curAPI.value = await db.getFunc(props.reqId);
            const p = await db.getReqParams(props.reqId);
            reqParms.value = JSON.stringify(p, null, 2);
        } else {
            console.log('SrRecReqDisplay onMounted: no reqId');
        }
    });

  </script>
  
  <style scoped>
  /* Style your button and component here */
  .sr-rec-req-display-panel {
    display: flex;
    flex-direction: column;
    padding: 0rem;
    margin-top: 0rem;
    max-height: 30rem;
    overflow-y: auto;
  }
  .sr-rec-req-display-panel-header {
    display: flex;
    margin-top: 0;
    font-size: medium;
    font-weight: bold;
    justify-content: flex-start;
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
  