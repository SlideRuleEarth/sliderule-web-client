<template>
  <div class="sr-progress-panel">
    <div class="sr-progress-panel-content">
        <span>State: {{ readState }}</span>
        <span v-if="!isArrowStream">
            Atl06 Records: {{ numAtl06Records }}
            <span v-if="targetAtl06Records !== 0">
                    / {{ targetAtl06Records }} {{ percentageAtl06Recs }}%
            </span> 
        </span>
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
            {{ useCurAtl06ReqSumStore().getPercentComplete() }} % complete 
        </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useCurAtl06ReqSumStore } from '@/stores/curAtl06ReqSumStore';


onMounted(() => {
    console.log('SrProgress.vue onMounted ');
});
const targetAtl06Records = computed(() => useCurAtl06ReqSumStore().getTgtAtl06Recs());
const numAtl06Records = computed(() => useCurAtl06ReqSumStore().getNumAtl06Recs());
const targetArrowDataRecords = computed(() => useCurAtl06ReqSumStore().getTgtArrowDataRecs());
const numArrowDataRecords = computed(() => useCurAtl06ReqSumStore().getNumArrowDataRecs());
const targetArrowMetaRecords = computed(() => useCurAtl06ReqSumStore().getTgtArrowMetaRecs());
const numArrowMetaRecords = computed(() => useCurAtl06ReqSumStore().getNumArrowMetaRecs());
const targetExceptions = computed(() => useCurAtl06ReqSumStore().getTgtExceptions());
const numExceptions = computed(() => useCurAtl06ReqSumStore().getNumExceptions());
const readState = computed(() => useCurAtl06ReqSumStore().getReadState());
const isArrowStream = computed(() => useCurAtl06ReqSumStore().getIsArrowStream());

const percentageExceptions = computed(() => {
    const curAtl06ReqSumStore = useCurAtl06ReqSumStore();
    if (curAtl06ReqSumStore.getTgtExceptions() > 0) {
        return (curAtl06ReqSumStore.getNumExceptions()/ curAtl06ReqSumStore.getTgtExceptions()) * 100;
    }
    return 0;
});
const percentageAtl06Recs = computed(() => {
    const curAtl06ReqSumStore = useCurAtl06ReqSumStore();
    if (curAtl06ReqSumStore.getTgtAtl06Recs() > 0) {
        return (curAtl06ReqSumStore.getNumAtl06Recs()/ curAtl06ReqSumStore.getTgtAtl06Recs()) * 100;
    }
    return 0;
});
const percentageArrowDataRecs = computed(() => {
    const curAtl06ReqSumStore = useCurAtl06ReqSumStore();
    if (curAtl06ReqSumStore.getTgtArrowDataRecs() > 0) {
        return (curAtl06ReqSumStore.getNumArrowDataRecs()/ curAtl06ReqSumStore.getTgtArrowDataRecs()) * 100;
    }
    return 0;
});
const percentageArrowMetaRecs = computed(() => {
    const curAtl06ReqSumStore = useCurAtl06ReqSumStore();
    if (curAtl06ReqSumStore.getTgtArrowMetaRecs() > 0) {
        return (curAtl06ReqSumStore.getNumArrowMetaRecs()/ curAtl06ReqSumStore.getTgtArrowMetaRecs()) * 100;
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
.sr-progress-panel-bb {
  display: flex;
  justify-content: center;
}
</style>
