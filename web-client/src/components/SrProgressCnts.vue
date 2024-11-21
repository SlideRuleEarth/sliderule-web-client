<template>
  <div class="sr-progress-panel">
    <div class="sr-progress-panel-content">
        <span>State: {{ readState }}</span>
        <span>
            Arrow Data Records: {{ numArrowDataRecords }}
            <span v-if="targetArrowDataRecords !== 0">
                    / {{ targetArrowDataRecords }} {{ percentageArrowDataRecs }}%
            </span> 
        </span>
        <span>
            Arrow Meta Records: {{ numArrowMetaRecords }}
            <span v-if="targetArrowDataRecords !== 0">
                    / {{ targetArrowMetaRecords }} {{ percentageArrowMetaRecs }}%
            </span> 
        </span>
        <span>
            Exceptions: {{ numExceptions }} 
            <span v-if="targetExceptions !== 0">
                 / {{ targetExceptions }} {{percentageExceptions}}%
            </span>
        </span>
        <span>
            {{ useCurReqSumStore().percentComplete }} % complete 
        </span>
    </div>
    <div class="sr-progress">
        <ProgressBar :value="useCurReqSumStore().percentComplete" />
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import ProgressBar from 'primevue/progressbar';

onMounted(() => {
    //console.log('SrProgress.vue onMounted ');
});
const targetArrowDataRecords = computed(() => useCurReqSumStore().tgtArrowDataRecs);
const numArrowDataRecords = computed(() => useCurReqSumStore().numArrowDataRecs);
const targetArrowMetaRecords = computed(() => useCurReqSumStore().tgtArrowMetaRecs);
const numArrowMetaRecords = computed(() => useCurReqSumStore().numArrowMetaRecs);
const targetExceptions = computed(() => useCurReqSumStore().tgtExceptions);
const numExceptions = computed(() => useCurReqSumStore().numExceptions);
const readState = computed(() => useCurReqSumStore().readState);

const percentageExceptions = computed(() => {
    const curReqSumStore = useCurReqSumStore();
    if (curReqSumStore.tgtExceptions > 0) {
        return (curReqSumStore.numExceptions/ curReqSumStore.tgtExceptions) * 100;
    }
    return 0;
});
const percentageArrowDataRecs = computed(() => {
    const curReqSumStore = useCurReqSumStore();
    if (curReqSumStore.tgtArrowDataRecs > 0) {
        return (curReqSumStore.numArrowDataRecs/ curReqSumStore.tgtArrowDataRecs) * 100;
    }
    return 0;
});
const percentageArrowMetaRecs = computed(() => {
    const curReqSumStore = useCurReqSumStore();
    if (curReqSumStore.tgtArrowMetaRecs > 0) {
        return (curReqSumStore.numArrowMetaRecs/ curReqSumStore.tgtArrowMetaRecs) * 100;
    }
    return 0;
});

</script>

<style scoped>
/* Style your button and component here */
.sr-progress-panel {
  display: flex;
  flex-direction: column;
  padding: 0.0125rem;
}
.sr-progress-panel-content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: left;
  font-size: smaller;
}
</style>
