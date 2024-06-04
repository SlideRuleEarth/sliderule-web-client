<template>
  <div class="sr-progress-panel">
    <div class="sr-progress-panel-content">
        <span>State: {{ readState }}</span>
        <span v-if="isArrowStream">
            Arrow Data Records: {{ numArrowDataRecords }}
            <span v-if="targetArrowDataRecords !== 0">
                    / {{ targetArrowDataRecords }} {{ percentageArrowDataRecs }}%
            </span> 
        </span>
        <span v-if="isArrowStream">
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
            {{ useCurReqSumStore().getPercentComplete() }} % complete 
        </span>
    </div>
    <div class="sr-progress">
        <ProgressBar :value="useCurReqSumStore().getPercentComplete()" />
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import ProgressBar from 'primevue/progressbar';

onMounted(() => {
    console.log('SrProgress.vue onMounted ');
});
const targetArrowDataRecords = computed(() => useCurReqSumStore().getTgtArrowDataRecs());
const numArrowDataRecords = computed(() => useCurReqSumStore().getNumArrowDataRecs());
const targetArrowMetaRecords = computed(() => useCurReqSumStore().getTgtArrowMetaRecs());
const numArrowMetaRecords = computed(() => useCurReqSumStore().getNumArrowMetaRecs());
const targetExceptions = computed(() => useCurReqSumStore().getTgtExceptions());
const numExceptions = computed(() => useCurReqSumStore().getNumExceptions());
const readState = computed(() => useCurReqSumStore().getReadState());
const isArrowStream = computed(() => useCurReqSumStore().getIsArrowStream());

const percentageExceptions = computed(() => {
    const curReqSumStore = useCurReqSumStore();
    if (curReqSumStore.getTgtExceptions() > 0) {
        return (curReqSumStore.getNumExceptions()/ curReqSumStore.getTgtExceptions()) * 100;
    }
    return 0;
});
const percentageArrowDataRecs = computed(() => {
    const curReqSumStore = useCurReqSumStore();
    if (curReqSumStore.getTgtArrowDataRecs() > 0) {
        return (curReqSumStore.getNumArrowDataRecs()/ curReqSumStore.getTgtArrowDataRecs()) * 100;
    }
    return 0;
});
const percentageArrowMetaRecs = computed(() => {
    const curReqSumStore = useCurReqSumStore();
    if (curReqSumStore.getTgtArrowMetaRecs() > 0) {
        return (curReqSumStore.getNumArrowMetaRecs()/ curReqSumStore.getTgtArrowMetaRecs()) * 100;
    }
    return 0;
});

</script>

<style>
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
