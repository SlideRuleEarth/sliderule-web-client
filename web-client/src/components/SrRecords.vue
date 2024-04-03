<template>
    <div class="sr-records-container">
        <DataTable :value="jobsStore.jobs" tableStyle="min-width: 50rem">
            <Column field="Star" header="">
                <template #body="slotProps">
                    <i 
                      :class="[slotProps.data.Star ? PrimeIcons.STAR_FILL : PrimeIcons.STAR]"
                      @click="() => jobsStore.toggleStar(slotProps.data.ID)"
                    ></i>
                </template>
            </Column>
            <Column v-for="col in jobsStore.filteredColumns" :key="col.field" :field="col.field" :header="col.header"></Column>
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

onMounted(() => {
    console.log('SrRecords mounted');
});
</script>
@/stores/jobsStore