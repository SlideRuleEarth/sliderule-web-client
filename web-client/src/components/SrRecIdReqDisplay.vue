<template>
    <div class="sr-rec-req-display-panel">
        <div class="sr-rec-req-display-panel-header"> 
            <SrCheckbox
                v-model="showReqParms"
                label="Show Request Parameters"
            />
        </div>
        <div class="sr-rec-req-display-parms" v-if="showReqParms">
            <div><pre><code>endpoint = {{ curAPI }}<br>{{ reqParms }}</code></pre></div>
        </div>
    </div>
  </template>
  
  <script setup lang="ts">
    import { ref,onMounted,watch } from "vue";
    import SrCheckbox from "./SrCheckbox.vue";
    import { db } from "@/db/SlideRuleDb";
    import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";

    const atlChartFilterStore = useAtlChartFilterStore();

    const showReqParms = ref(false);
    const reqParms = ref<string>('');
    const curAPI = ref<string>('');;

    onMounted(async () => {
        const reqId = atlChartFilterStore.getReqId();
        if(reqId) {
            curAPI.value = await db.getFunc(reqId);
            const p = await db.getReqParams(reqId);
            reqParms.value = JSON.stringify(p, null, 2);
        } else {
            console.log('SrRecReqDisplay onMounted: no reqId');
        }
    });
    watch( () => atlChartFilterStore.getReqId(), async (newReqId, oldReqId) => {
        console.log(`SrRecReqDisplay watch atlChartFilterStore reqId oldReqId:'${oldReqId} to newReqId:'${newReqId}`);
        if (newReqId) {
            curAPI.value = await db.getFunc(newReqId);
            const p = await db.getReqParams(newReqId);
            reqParms.value = JSON.stringify(p, null, 2);
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
  