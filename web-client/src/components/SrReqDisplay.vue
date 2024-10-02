<template>
    <div class="sr-req-display-panel">
            <div class="sr-req-display-panel-header"> 
                <SrCheckbox
                    v-model="showReqParms"
                    label="Show Request Parameters"
                />
            </div>
            <div 
                class="sr-req-display-parms" 
                v-if="showReqParms"
                @click="copyToClipboard"
                @mouseenter="isHovered = true"
                @mouseleave="isHovered = false"
            >
                <div class="hover-overlay" v-if="isHovered"></div>
                <pre><code>{{ reqParms }}</code></pre>
            </div>
        
    </div>
  </template>
  
  <script setup lang="ts">
    import { computed, ref } from "vue";
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import SrCheckbox from "./SrCheckbox.vue";
    import { useSrToastStore } from "@/stores/srToastStore";

    const reqParamsStore = useReqParamsStore();
    const showReqParms = ref(false);
    const isHovered = ref(false);

    const reqParms = computed(() => {
      // NOTE: we use request ID of zero as a placeholder for the current request
      return  JSON.stringify(reqParamsStore.getAtlxxReqParams(0),null,2);
    });

    const copyToClipboard = () => {
      navigator.clipboard.writeText(reqParms.value)
        .then(() => {
          const msg = 'Request parameters copied to clipboard';
          console.log(msg);
          useSrToastStore().info('Copied to clipboard', msg);
          // You can add a notification here if desired
        })
        .catch(err => {
          console.error('Failed to copy content: ', err);
        });
    };
  </script>
  
  <style scoped>
.sr-req-display-panel {
  display: flex;
  flex-direction: column;
  max-height: 30rem; /* Limit the overall height */
  overflow-y: auto; /* Add vertical scrolling if needed */
}

.sr-req-display-panel-header {
  display: flex;
  margin-bottom: 0.25rem;
  font-size: medium;
  justify-content: flex-start; /* Align to the left */
}

.sr-req-display-parms {
  position: relative;
  cursor: pointer;
  background-color: #2c2c2c;
  padding: 1rem;
  border-radius: 0.5rem;
  
  display: flex;
  justify-content: flex-start;
  max-height: 15rem; /* Limit the height of the JSON display */
  overflow-y: auto;
  overflow-x: auto;
  width: 100%; /* Ensure full width */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* Internet Explorer 10+ */
}

.sr-req-display-parms::-webkit-scrollbar {
  display: none; /* WebKit */
}

.sr-req-display-parms pre {
  margin: 0;
  width: 100%;
}

.hover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.1);
  pointer-events: none;
}
</style>
