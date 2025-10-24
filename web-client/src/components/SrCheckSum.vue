<template>
    <div class="sr-checksum-panel">
        <div class="sr-checksum-panel-content">
            <div class="sr-checksum-parms" >
                <pre><code>{{ checksum }}</code></pre>
            </div>
        </div>
    </div>
  </template>
  
  <script setup lang="ts">
    import { ref, onMounted } from "vue";
    import { useRequestsStore } from "@/stores/requestsStore";
    import { createLogger } from '@/utils/logger';

    const logger = createLogger('SrCheckSum');

    const props = defineProps({
        reqId: {
            type: Number,
            required: true
        }
    });
    const requestsStore = useRequestsStore();
    const checksum = ref<boolean>(false);
    onMounted(async () => {
        checksum.value = await requestsStore.has_checksum(props.reqId);
        logger.debug('onMounted Loading SrCheckSum', { reqId: props.reqId, checksum: checksum.value });
    });
    
  </script>
  
  <style scoped>
  /* Style your button and component here */
  .sr-checksum-panel {
    display: flex;
    flex-direction: column;
    padding: 0rem;
    margin-top: 0rem;
  }
  .sr-checksum-panel-content {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    font-size: smaller;
    padding: 0rem;
  }
.sr-checksum-parms {
    display: flex;
    justify-content: center;
    margin-top: 0rem;
}
  </style>
  