<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import 'primeicons/primeicons.css'
import { useRequestsStore } from '@/stores/requestsStore'; // Adjust the path based on your file structure
import router from '@/router/index';
import { db } from '@/db/SlideRuleDb';
import { deleteOpfsFile, calculateChecksumFromOpfs } from '@/utils/SrParquetUtils';
import { findParam } from '@/utils/parmUtils';
import { formatBytes } from '@/utils/SrParquetUtils';
import InputText from 'primevue/inputtext'; // Import InputText for editing
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import SrImportParquetFile  from '@/components/SrImportParquetFile.vue';
import { cleanupAllRequests } from '@/utils/storageUtils';
import SrCustomTooltip from './SrCustomTooltip.vue';

const atlChartFilterStore = useAtlChartFilterStore();
const requestsStore = useRequestsStore();
const isReqParmCodeFmt = ref(true);
const isSvrParmCodeFmt = ref(true);


const onEditComplete = (data: Record<string, any>, field: string, event: Event) => {
    const inputElement = event.target as HTMLInputElement;
    const newValue = inputElement.value.trim();
    //data[field] = newValue; // Update the specific field with the new value
    db.updateRequestRecord({req_id: data.req_id, description: data.description}, false);
    console.log('Edit completed:', field, 'New Value:', newValue, 'Data:', data);
};
const analyze = (id:number) => {
    try {
        console.log('Analyze ', id);
        if (!id) {
            console.error('Request id is missing for analyze request');
            return;
        }
        atlChartFilterStore.setReqId(id);
        router.push(`/analyze/${id}`);
        console.log('Router Push for Analyze request for id:', id, ' is successful');
    } catch (error) {
        console.error(`Failed to analyze request for id:${id}`, error);
        throw error;
    }
};

async function calculateCS(req_id:number) {
    console.log('Calculate Checksum for: ', req_id);
    console.log('Exporting file for req_id', req_id);
    try {
        const fileName = await db.getFilename(req_id);
        const opfsRoot = await navigator.storage.getDirectory();
        const fileHandle = await opfsRoot.getFileHandle(fileName, {create:false});
        const cs = await calculateChecksumFromOpfs(fileHandle);
        const db_cs = await db.getChecksum(req_id);

        console.log('Checksum:', cs, 'DB Checksum:', db_cs, 'db_cs type:', typeof(db_cs), ' cs type:', typeof(cs), ' for id:', req_id);
        if (cs == db_cs) {
            console.log('Checksum verified successfully for id:', req_id);
            alert(`Req:${req_id} Checksum verified successfully!`);
        } else {
            console.error('Checksum verification failed for id:', req_id);
            alert(`Req:${req_id} Checksum Verification FAILED!`);
        }
        console.log('Checksum:', cs);
    } catch (error) {
        console.error(`Failed to calculate CS for id:${req_id}`, error);
        alert(`Failed to calculate CS for ID:${req_id}`);
        throw error;
    }
};

const deleteReq = async (id:number) => {
    try {
        const userConfirmed = window.confirm('Are you sure you want to delete this record?');
        if (userConfirmed) {
            console.log('Delete ', id);
            const fn = await db.getFilename(id);
            await deleteOpfsFile(fn);
            requestsStore.deleteReq(id);
            console.log('Record deleted successfully for id:', id);
        } else {
            console.log('Deletion cancelled');
        }
    } catch (error) {
        console.error(`Failed to delete record for id:${id}`, error);
        throw error;
    }
};

const exportFile = async (req_id:number) => {
    console.log('Exporting file for req_id', req_id);
    try {
        const fileName = await db.getFilename(req_id);
        const opfsRoot = await navigator.storage.getDirectory();
        const folderName = 'SlideRule'; 
        const directoryHandle = await opfsRoot.getDirectoryHandle(folderName, { create: false });
        const fileHandle = await directoryHandle.getFileHandle(fileName, {create:false});
        const file = await fileHandle.getFile();
        const url = URL.createObjectURL(file);
        // Create a download link and click it programmatically
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Revoke the object URL
        URL.revokeObjectURL(url);
        const msg = `File ${fileName} exported successfully!`;
        console.log(msg);
        alert(msg);

    } catch (error) {
        console.error(`Failed to calculate CS for id:${req_id}`, error);
        alert(`Failed to calculate CS for ID:${req_id}`);
        throw error;
    }
};

const deleteAllReqs = () => {
    console.log('deleteAllReqs');
    cleanupAllRequests();
};

const confirmDeleteAllReqs = () => {
    const userConfirmed = window.confirm('Are you sure you want to delete all requests?');
    if (userConfirmed) {
        deleteAllReqs();
        console.log('Confirmed Delete all');
    } else {
        console.log('Deletion cancelled');
    }
};

onMounted(() => {
    console.log('SrRecords mounted');
    requestsStore.watchReqTable();
    requestsStore.fetchReqs();
});

onUnmounted(() => {
    requestsStore.unWatchReqTable();
});

const tooltipRef = ref();

</script>

<template>
    <div class="sr-records-container">
        <DataTable 
            :value="requestsStore.reqs" 
            tableStyle="min-width: 50rem width: 100%" 
            table-layout="auto"
            scrollable 
            scrollHeight="flex"
            :paginator="true"
            :rows="3"
            :rowsPerPageOptions="[3,5,10,20]"
            editMode="cell"
        >
            <Column field="Star" header="">
                <template #body="slotProps">
                    <i 
                      :class="[slotProps.data.star ? 'pi pi-star-fill' : 'pi pi-star' ]"
                      @click="() => requestsStore.toggleStar(slotProps.data.req_id)"
                    ></i>
                </template>
            </Column>
            <Column field="req_id" header="ID"></Column>
            <Column field="status" header="Status"> 
                <template #body="slotProps">
                    <span
                        @mouseover="tooltipRef.showTooltip($event, slotProps.data.status_details)"
                        @mouseleave="tooltipRef.hideTooltip"
                    >
                        {{ slotProps.data.status }}
                    </span>
               </template>
            </Column>
            <Column field="func" header="Function"></Column>
            <Column field="description" header="Description" :editable="true">
                <template #header>
                    <i 
                      class="pi pi-pencil"
                      @mouseover="tooltipRef.showTooltip($event, 'Editable Description')"
                      @mouseleave="tooltipRef.hideTooltip"
                    ></i>
                </template>
                <template #editor="{ data }">
                    <InputText
                        v-model="data.description"
                        class="p-inputtext p-component"
                        @keydown.enter="(event) => onEditComplete(data, 'description', event)"
                        @blur="(event) => onEditComplete(data, 'description', event)"
                    />
                </template>
            </Column>
            <Column field="srViewName" header="View"></Column>
            <Column field="parameters" header="Req Parms" class="sr-par-fmt">
                <template #header>
                    <i 
                      class="pi pi-code sr-toggle-icon"
                      @click="isReqParmCodeFmt = !isReqParmCodeFmt"
                      @mouseover="tooltipRef.showTooltip($event, 'Toggle Code Format')"
                      @mouseleave="tooltipRef.hideTooltip"
                    > </i>
                </template> 
                <template #body="slotProps">
                    <div class="sr-col-par-style" >
                        <span v-if="isReqParmCodeFmt"><pre><code>{{slotProps.data.parameters}}</code></pre></span>
                        <span v-else>{{slotProps.data.parameters}}</span>
                    </div>
                </template>
            </Column>
            <Column field="svr_parms" header="Svr Parms" class="sr-par-fmt">
                <template #header>
                    <i 
                      class="pi pi-code sr-toggle-icon"
                      @click="isSvrParmCodeFmt = !isSvrParmCodeFmt"
                      @mouseover="tooltipRef.showTooltip($event, 'Toggle Code Format')"
                      @mouseleave="tooltipRef.hideTooltip"
                    > </i>
                </template> 
                <template #body="slotProps">
                    <div class="sr-col-par-style" >
                        <span v-if="isSvrParmCodeFmt"><pre><code>{{slotProps.data.svr_parms}}</code></pre></span>
                        <span v-else>{{slotProps.data.svr_parms}}</span>
                    </div>
                </template>
            </Column>
            <Column field="cnt" header="Count">
                <template #body="slotProps">
                    {{ new Intl.NumberFormat().format(parseInt(String(slotProps.data.cnt)))  }}
                </template>
            </Column>
            <Column field="num_bytes" header="Size">
                <template #body="slotProps">
                    {{ formatBytes(slotProps.data.num_bytes) }}
                </template>
            </Column>
            <Column field="elapsed_time" header="Elapsed Time"></Column>
            <Column field="Actions" header="Analyze" class="sr-analyze">
                <template #body="slotProps">
                    <i 
                      class="pi pi-chart-line"
                      v-if="((slotProps.data.status == 'success') || (slotProps.data.status == 'imported'))"
                      @click="analyze(slotProps.data.req_id)"
                      @mouseover="tooltipRef.showTooltip($event, 'Analyze')"
                      @mouseleave="tooltipRef.hideTooltip"
                    ></i>
                </template>
            </Column>
            <Column field="Actions" header="" class="sr-src-code">
                <template #body="slotProps">
                    <i 
                      class="pi pi-calculator sr-calculator-icon"
                      v-if="findParam(slotProps.data.parameters, 'with_checksum')"
                      @click="calculateCS(slotProps.data.req_id)"
                      @mouseover="tooltipRef.showTooltip($event, 'Verify Checksum')"
                      @mouseleave="tooltipRef.hideTooltip"
                    ></i>
                </template>
            </Column>
            <Column field="Actions" header="" class="sr-delete">
                <template #header>
                    <i 
                      class="pi pi-trash"
                      @click="confirmDeleteAllReqs()"
                      @mouseover="tooltipRef.showTooltip($event, 'Delete ALL Requests')"
                      @mouseleave="tooltipRef.hideTooltip"
                    ></i>
                </template>
                <template #body="slotProps">
                    <i 
                      class="pi pi-trash"
                      @click="deleteReq(slotProps.data.req_id)"
                      @mouseover="tooltipRef.showTooltip($event, 'Delete Requests')"
                      @mouseleave="tooltipRef.hideTooltip"
                    ></i>
                </template>
            </Column>
            <Column field="Actions" header="" class="sr-export">
                <template #header>
                    <div 
                        class="sr-file-import"
                        @mouseover="tooltipRef.showTooltip($event, 'Import a SlideRule Parquet File')" 
                        @mouseleave="tooltipRef.hideTooltip"
                    >
                        <SrImportParquetFile />
                    </div>
                </template>
                <template #body="slotProps">
                    <i 
                      class="pi pi-file-export sr-file-export-icon"
                      @click="exportFile(slotProps.data.req_id)"
                      @mouseover="tooltipRef.showTooltip($event, 'Export File')"
                      @mouseleave="tooltipRef.hideTooltip"
                    ></i>
                </template>
            </Column>
        </DataTable>
        <SrCustomTooltip ref="tooltipRef"/>

        <!-- Display an error message if there is an error -->
        <div v-if="requestsStore.autoFetchError" class="error-message">
            {{ requestsStore.autoFetchErrorMsg }}
        </div>
    </div>
</template>

<style scoped>
.sr-records-container {
    display: block;
    width: 100%;
    overflow-x: auto;
    padding: 0.5rem;
    border-color: transparent;
    border-width: 0.5rem;
    border-style: solid;
}

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
.sr-par-fmt {
    margin-left: 1rem;
}
.sr-recs-toggle-icon {
    margin-right: 0.5rem;
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
:deep(.sr-col-par-style) {
    min-width: 7rem;
    max-width: 25rem;
    max-height: 10rem;
    overflow: auto;
    overflow-x: auto;
}
:deep(.p-inputtext.p-component) {
    width: 100%;
    border: 1px solid var(--p-border-color);
}
</style>
