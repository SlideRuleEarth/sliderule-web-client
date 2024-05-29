
<script setup lang="ts">
import { onMounted,onUnmounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { PrimeIcons } from 'primevue/api';
import { useRequestsStore } from '@/stores/requestsStore'; // Adjust the path based on your file structure
import router from '@/router/index';
import { db } from '@/db/SlideRuleDb';
import { deleteOpfsFile } from '@/utils/SrParquetUtils';

const requestsStore = useRequestsStore();

const analyze = (id:number) => {
    console.log('Analyze ', id);
    router.push(`/analyze/${id}`);
};

const sourceCodePopup = (id:number) => {
    console.log('Source code ', id);
};

const deleteReq = async (id:number) => {
    try{
        console.log('Delete ', id);
        const fn = await db.getFilename(id);
        await deleteOpfsFile(fn);
        requestsStore.deleteReq(id);
    } catch (error) {
        console.error(`Failed to delete request for id:${id}`, error);
        throw error;
    }
};

const deleteAllReqs = () => {
    console.log('Delete all');
    requestsStore.reqs.forEach(async (req) => {
        try {
            if(req.req_id) {
                const fn = await db.getFilename(req.req_id);
                await deleteOpfsFile(fn);
            } else {
                console.error(`Request id is missing for request:`, req);
            }
        } catch (error) {
            console.error(`Failed to delete request for id:${req.req_id}`, error);
            throw error;
        }
    });
    requestsStore.deleteAllReqs();
};

onMounted(() => {
    console.log('SrRecords mounted');
    requestsStore.watchReqTable();
    requestsStore.fetchReqs();
});

onUnmounted(() => {
  requestsStore.liveRequestsQuerySubscription.unsubscribe();
});

</script>

<template>
    <div class="sr-records-container">
        <DataTable :value="requestsStore.reqs" tableStyle="min-width: 50rem" scrollable scrollHeight="50rem">
            <Column field="Star" header="">
                <template #body="slotProps">
                    <i 
                      :class="[slotProps.data.star ? PrimeIcons.STAR_FILL : PrimeIcons.STAR]"
                      @click="() => requestsStore.toggleStar(slotProps.data.req_id)"
                    ></i>
                </template>
            </Column>
            <Column field="req_id" header="ID"></Column>
            <Column field="status" header="Status"> 
                <template #body="slotProps">
                    <span v-tooltip="slotProps.data.status_details">
                        {{ slotProps.data.status }}
                    </span>
                </template>
            </Column>
            <Column field="func" header="Function"></Column>
            <Column field="parameters" header="Parameters"></Column>
            <Column field="elapsed_time" header="Elapsed Time"></Column>
            <!-- <Column v-for="col in filteredColumns" :key="col.field" :field="col.field" >
                <template #header="">
                    <span v-tooltip="col.tooltip">{{ col.header }}</span>
                </template>
            </Column> -->
            <Column field="Actions" header="" class="sr-analyze">
                <template #body="slotProps">
                    <i 
                      class="pi pi-chart-line "
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
            <Column field="Actions" header="Delete All" class="sr-delete">
                <template #header>
                    <i 
                      :class="PrimeIcons.TRASH"
                      @click="deleteAllReqs()"
                      v-tooltip="'Delete all reqs'"
                    ></i>
                </template>
                <template #body="slotProps">
                    <i 
                      :class="PrimeIcons.TRASH"
                      @click="deleteReq(slotProps.data.req_id)"
                      v-tooltip="'Delete req'"
                    ></i>
                </template>
            </Column>
        </DataTable>
        <!-- Display an error message if there is an error -->
        <div v-if="requestsStore.autoFetchError" class="error-message">
        {{ requestsStore.autoFetchErrorMsg }}
        </div>
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
.sr-delete {
    width: 5rem;
    text-align: center;
    cursor: pointer;
}
.error-message {
    color: red;
    font-size: 1.5rem;
    margin-top: 1rem;
}

</style>