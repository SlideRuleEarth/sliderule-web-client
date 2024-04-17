
<script setup lang="ts">
import { onMounted,onUnmounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { PrimeIcons } from 'primevue/api';
import { useReqsStore } from '@/stores/requestsStore'; // Adjust the path based on your file structure

const requestsStore = useReqsStore();

const analyze = (id:number) => {
    console.log('Analyze ', id);
};

const sourceCodePopup = (id:number) => {
    console.log('Source code ', id);
};

onMounted(() => {
    console.log('SrRecords mounted');
    const reqsStore = useReqsStore();
    reqsStore.watchReqTable();
});

onUnmounted(() => {
  const reqsStore = useReqsStore();
  reqsStore.liveQuerySubscription.unsubscribe();
});

</script>

<template>
    <div class="sr-records-container">
        <DataTable :value="requestsStore.reqs" tableStyle="min-width: 50rem">
            <Column field="Star" header="">
                <template #body="slotProps">
                    <i 
                      :class="[slotProps.data.star ? PrimeIcons.STAR_FILL : PrimeIcons.STAR]"
                      @click="() => requestsStore.toggleStar(slotProps.data.req_id)"
                    ></i>
                </template>
            </Column>
            <Column v-for="col in requestsStore.columns" :key="col.field" :field="col.field" >
                <template #header="">
                    <span v-tooltip="col.tooltip">{{ col.header }}</span>
                </template>
            </Column>
            <Column field="Actions" header="" >
                <template #body="slotProps">
                    <i 
                      class="pi pi-chart-line sr-text-with-code-icon"
                      @click="analyze(slotProps.data.req_id)"
                      v-tooltip="'Analyze'"
                    ></i>
                </template>
            </Column>
            <Column field="Actions" header="" class="sr-src-code">
                <template #body="slotProps">
                    <i 
                      class="pi pi-code sr-src-code-icon "
                      @click="sourceCodePopup(slotProps.data.req_id)"
                      v-tooltip="'View source code'"
                    ></i>
                </template>
            </Column>
            <Column field="Actions" header="" class="sr-analyze">
                <template #body="slotProps">
                    <i 
                      :class="PrimeIcons.TRASH"
                      @click="() => requestsStore.deleteReq(slotProps.data.id)"
                      v-tooltip="'Delete req'"
                    ></i>
                </template>
            </Column>
        </DataTable>
    </div>
</template>

<style scoped>

.sr-analyze {
    width: 5rem;
    text-align: center;
    cursor: pointer;
}
.sr-src-code {
    width: 5rem;
    text-align: center;
    cursor: pointer;
}
.sr-text-with-icon {
   cursor: pointer;
}

</style>