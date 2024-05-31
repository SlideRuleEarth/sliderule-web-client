<template>
    <div class="sr-req-display-panel">
        <div class="sr-req-display-panel-content">
            <div class="sr-req-display-panel-header"> 
                <SrCheckbox
                    v-model="showReqParms"
                    label="Show Request Parameters"
                />
            </div>
            <div class="sr-req-display-parms" v-if="showReqParms">
                <pre><code>{{ reqParms }}</code></pre>
            </div>
        </div>
    </div>
  </template>
  
  <script setup lang="ts">
    import { computed,ref } from "vue";
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import SrCheckbox from "./SrCheckbox.vue";

    const reqParamsStore = useReqParamsStore();
    const showReqParms = ref(false);
    const reqParms = computed(() => {
        return  JSON.stringify(reqParamsStore.getAtl06ReqParams(0),null,2);
    });
  </script>
  
  <style>
  /* Style your button and component here */
  .sr-req-display-panel {
    display: flex;
    flex-direction: column;
    padding: 0rem;
    margin-top: 0rem;
  }
  .sr-req-display-panel-header {
    display: flex;
    margin-top: 0;
    font-size: medium;
    font-weight: bold;
    justify-content: center;
  }
  .sr-req-display-panel-content {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    font-size: smaller;
    padding: 0rem;
  }
.sr-req-display-parms {
    display: flex;
    justify-content: center;
    margin-top: 0rem;
}
  </style>
  