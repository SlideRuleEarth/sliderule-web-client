<template>
    <div class="sr-rec-req-display-panel">
        <div class="sr-rec-req-display-panel-content">
            <div class="sr-rec-req-display-panel-header"> 
                <SrCheckbox
                    v-model="showReqParms"
                    label="Show Request Parameters"
                />
            </div>
            <div class="sr-rec-req-display-parms" v-if="showReqParms">
                <pre><code>{{ reqParms }}</code></pre>
            </div>
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

    onMounted(async () => {
        const reqId = atlChartFilterStore.getReqId();
        if(reqId) {
            const p = await db.getReqParams(reqId);
            reqParms.value = JSON.stringify(p, null, 2);
        } else {
            console.log('SrRecReqDisplay onMounted: no reqId');
        }
    });
    watch( () => atlChartFilterStore.getReqId(), async (newReqId, oldReqId) => {
        console.log(`SrRecReqDisplay watch atlChartFilterStore reqId oldReqId:'${oldReqId} to newReqId:'${newReqId}`);
        if (newReqId) {
            const p = await db.getReqParams(newReqId);
            reqParms.value = JSON.stringify(p, null, 2);
        }
    });
  </script>
  
  <style>
  /* Style your button and component here */
  .sr-rec-req-display-panel {
    display: flex;
    flex-direction: column;
    padding: 0rem;
    margin-top: 0rem;
  }
  .sr-rec-req-display-panel-header {
    display: flex;
    margin-top: 0;
    font-size: medium;
    font-weight: bold;
    justify-content: center;
  }
  .sr-rec-req-display-panel-content {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    font-size: smaller;
    padding: 0rem;
  }
.sr-rec-req-display-parms {
    display: flex;
    justify-content: center;
    margin-top: 0rem;
    overflow-y: auto;
    max-height: 10rem;
}
  </style>
  