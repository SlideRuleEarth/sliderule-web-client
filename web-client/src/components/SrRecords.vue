<template>
    <div class="sr-records-container">
        <DataTable :value="jobs" tableStyle="min-width: 50rem">
            <Column field="Star" header="">
                <template #body="slotProps">
                    <i 
                      :class="[slotProps.data.Star ? PrimeIcons.STAR_FILL : PrimeIcons.STAR]"
                      @click="toggleStar(slotProps.data)"
                    ></i>
                </template>
            </Column>
            <Column v-for="col in filteredColumns" :key="col.field" :field="col.field" :header="col.header"></Column>
        </DataTable>
    </div>
</template>


<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { PrimeIcons } from 'primevue/api';

interface Job {
    Star: boolean;
    ID: number;
    Status: string;
    Parameters: any;
}

const jobs = ref<Job[]>([]);
    const tjobs = ref<Job[]>(
    [
        {
            Star: false,
            ID: 1,
            Status: 'Completed',
            Parameters: 'Parameters placeholder'
        },
        {
            Star: true,
            ID: 2,
            Status: 'Completed',
            Parameters: 'Parameters placeholder'
        },
        {
            Star: false,
            ID: 3,
            Status: 'In Progress',
            Parameters: 'Parameters placeholder'
        },
        {
            Star: false,
            ID: 4,
            Status: 'Completed',
            Parameters: 'Parameters placeholder'
        },
        {
            Star: false,
            ID: 5,
            Status: 'Completed',
            Parameters: 'Parameters placeholder'
        }
    ] as Job[]
);

const columns = ref([
    { field: 'ID', header: 'ID' },
    { field: 'Status', header: 'Status' },
    { field: 'Parameters', header: 'Parameters' }
]);


// Computed property to filter out 'Star' if needed
const filteredColumns = computed(() => {
    // Assuming you want all columns in this example, but you can add filtering logic here
    return columns.value.filter(col => col.field !== 'Star');
});
const toggleStar = (job: Job) => {
    const jobIndex = jobs.value.findIndex(j => j.ID === job.ID);
    if (jobIndex !== -1) {
        jobs.value[jobIndex].Star = !jobs.value[jobIndex].Star;
    }
};

onMounted(() => {
    console.log('Mounted SrRecords');
    jobs.value = tjobs.value;
});
</script>
