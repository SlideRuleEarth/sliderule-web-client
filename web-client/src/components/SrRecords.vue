<template>
    <div class="sr-records-container">
        <DataTable :value="jobsStore.jobs" tableStyle="min-width: 50rem">
            <Column field="Star" header="">
                <template #body="slotProps">
                    <i 
                      :class="[slotProps.data.star ? PrimeIcons.STAR_FILL : PrimeIcons.STAR]"
                      @click="() => jobsStore.toggleStar(slotProps.data.id)"
                    ></i>
                </template>
            </Column>
            <Column v-for="col in jobsStore.columns" :key="col.field" :field="col.field" :header="col.header"></Column>
            <Column field="Actions" header="">
                <template #body="slotProps">
                    <i 
                      class="pi pi-chart-line"
                      @click="analyze(slotProps.data.id)"
                    > Analyze</i>
                </template>
            </Column>
            <Column field="Actions" header="">
                <template #body="slotProps">
                    <i 
                      class="pi pi-code"
                      @click="sourceCodePopup(slotProps.data.id)"
                    > Source code</i>
                </template>
            </Column>
            <Column field="Actions" header="">
                <template #body="slotProps">
                    <i 
                      :class="PrimeIcons.TRASH"
                      @click="() => jobsStore.deleteJob(slotProps.data.id)"
                    ></i>
                </template>
            </Column>
        </DataTable>
    </div>
</template>


<script setup lang="ts">
import { onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { PrimeIcons } from 'primevue/api';
import { useJobsStore } from '@/stores/jobsStore'; // Adjust the path based on your file structure

const jobsStore = useJobsStore();

const analyze = (id:number) => {
    console.log('Analyze ', id);
};

const sourceCodePopup = (id:number) => {
    console.log('Source code ', id);
};

onMounted(() => {
    console.log('SrRecords mounted');
});
</script>
