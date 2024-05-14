<template>
  <div class="sr-progress-panel">
    <div class="sr-progress-panel-content">
        <span>State: {{ readState }}</span>
        <span>
            Records: {{ numRecords }}
            <span v-if="targetRecords !== 0">
                    / {{ targetRecords }} {{ percentageRecs }}%
            </span> 
        </span>
        <span>
            Exceptions: {{ numExceptions }} 
            <span v-if="targetExceptions !== 0">
                 / {{ targetExceptions }} {{percentageExceptions}}%
            </span>
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
const targetRecords = computed(() => useCurAtl06ReqSumStore().getTgtRecs());
const numRecords = computed(() => useCurAtl06ReqSumStore().getNumRecs());
const targetExceptions = computed(() => useCurAtl06ReqSumStore().getTgtExceptions());
const numExceptions = computed(() => useCurAtl06ReqSumStore().getNumExceptions());
const readState = computed(() => useCurAtl06ReqSumStore().getReadState());

const percentageExceptions = computed(() => {
    const curAtl06ReqSumStore = useCurAtl06ReqSumStore();
    if (curAtl06ReqSumStore.getTgtExceptions() > 0) {
        return (curAtl06ReqSumStore.getNumExceptions()/ curAtl06ReqSumStore.getTgtExceptions()) * 100;
    }
    return 0;
});
const percentageRecs = computed(() => {
    const curAtl06ReqSumStore = useCurAtl06ReqSumStore();
    if (curAtl06ReqSumStore.getTgtRecs() > 0) {
        return (curAtl06ReqSumStore.getNumRecs()/ curAtl06ReqSumStore.getTgtRecs()) * 100;
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
