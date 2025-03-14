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
import SrImportParquetFile  from '@/components/SrImportParquetFile.vue';
import { cleanupAllRequests } from '@/utils/storageUtils';
import SrCustomTooltip from './SrCustomTooltip.vue';
import { useToast } from "primevue/usetoast";
import { useSrToastStore } from "@/stores/srToastStore";
import { useRecTreeStore } from "@/stores/recTreeStore";

const requestsStore = useRequestsStore();
const isReqParmCodeFmt = ref(true);
const isSvrParmCodeFmt = ref(true);
const toast = useToast();
const srToastStore = useSrToastStore();
const recTreeStore = useRecTreeStore();


const onEditComplete = async (data: Record<string, any>, field: string, event: Event) => {
    const inputElement = event.target as HTMLInputElement;
    const newValue = inputElement.value.trim();
    //data[field] = newValue; // Update the specific field with the new value
    await db.updateRequestRecord({req_id: data.req_id, description: data.description}, false);
    console.log('Edit completed:', field, 'New Value:', newValue, 'Data:', data);
};
const analyze = async (id:number) => {
    try {
        console.log('Analyze ', id);
        if(recTreeStore.findAndSelectNode(id)){
            router.push(`/analyze/${id.toString()}`);
            console.log('Router Push for Analyze request for id:', id, ' is successful');
        } else {
            console.error('Failed to set request id for analyze request id:', id);
            toast.add({ severity: 'error', summary: 'Invalid Record Id', detail: 'Failed to set record Id', life: srToastStore.getLife() });
        }
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

async function deleteRequest(id:number){
    let deleted = true;
    try {
        const fn = await db.getFilename(id);
        console.log('deleteRequest:', id, 'fileName:', fn);
        await deleteOpfsFile(fn);
        deleted = true; // If we get here, the file was deleted
    } catch (error) {
        console.error(`deleteRequest Failed to delete file for id:${id}`, error);
        deleted = false;
    }
    try {
        deleted = await requestsStore.deleteReq(id);
        console.log('deleteRequest Record deleted successfully for id:', id);
        await recTreeStore.loadTreeData();
        recTreeStore.initToFirstRecord();
    } catch (error) {
        console.error(`deleteRequest Failed to delete record for id:${id}`, error);
        deleted = false;
    }
    if (deleted) {
        toast.add({ severity: 'success', summary: 'Record Deleted', detail: `Record ${id} deleted successfully`, life: srToastStore.getLife() });
    } else {
        toast.add({ severity: 'error', summary: 'Record Deletion Failed', detail: `Failed to delete record ${id}`, life: srToastStore.getLife() });
    }
    console.log('deleteRequest:', id, 'deleted:', deleted);
    return deleted;
};

const deleteReqAndChildren = async (id:number) => {
    const children = await db.runContexts
            .where('parentReqId')
            .equals(id)
            .toArray();
    const listOfChildIds = children.map(child => child.reqId);
    let msg = `Are you sure you want to delete this record ${id}`;
    if(children.length > 0) {
        msg = `Are you sure you want to delete this record ${id} and all its children:${listOfChildIds}`;
    }
    const userConfirmed = window.confirm(msg);
    let deleteSuccessful = true;
    if (userConfirmed) {
        if (children.length > 0) {
            for (const child of children) {
                console.log('Deleting child:', child, ' of parent:', id);
                deleteSuccessful = deleteSuccessful && (await deleteRequest(child.reqId));
            }
        }
        deleteSuccessful = deleteSuccessful && (await deleteRequest(id));
    } else {
        console.log('deleteReqAndChildren Deletion cancelled');
        toast.add({ severity: 'warn', summary: 'Deletion Cancled', detail: `Record ${id} was NOT deleted`, life: srToastStore.getLife() });
        return false;
    }
    if (!deleteSuccessful) {
        toast.add({ severity: 'error', summary: 'Record Deletion Failed', detail: `Failed to delete record ${id}`, life: srToastStore.getLife() });
    }
    console.log('deleteReqAndChildren:', id, 'deleted:', deleteSuccessful);
}

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

onMounted(async () => {
    console.log('SrRecords mounted');
    requestsStore.watchReqTable();
    requestsStore.fetchReqs();
    //atlChartFilterStore.reqIdMenuItems =  await requestsStore.getMenuItems();
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
            tableStyle="min-width:100% width:100%;" 
            table-layout="auto"
            size="small" 
            :resizableColumns="true"
            columnResizeMode="expand"
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
            <Column field="description" header="Description" :editable="true" style="width: 5rem; max-width: 10rem;">
                <template #header>
                    <i 
                      class="pi pi-pencil"
                      @mouseover="tooltipRef.showTooltip($event, 'Editable Description')"
                      @mouseleave="tooltipRef.hideTooltip"
                    ></i>
                </template>
                <template #editor="{ data }">
                    <div class = "sr-descr-style">
                    <InputText
                        v-model="data.description"
                        class="p-inputtext p-component"
                        @keydown.enter="(event) => onEditComplete(data, 'description', event)"
                        @blur="(event) => onEditComplete(data, 'description', event)"
                    />
                    </div>
                </template>
                <template #body="slotProps">
                    <div class="sr-descr-style">
                        {{ slotProps.data.description }}
                    </div>
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
                      @click="deleteReqAndChildren(slotProps.data.req_id)"
                      @mouseover="tooltipRef.showTooltip($event, 'Delete this request and any of its children')"
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
    width: 100%;
    display: block;
    padding: 1.5rem;
    margin: 1.5rem;
    overflow-x: auto; /* Enable horizontal scrolling */
    overflow-y: hidden; /* Prevent vertical overflow unless needed */
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
    width: 10rem;
    min-width: 7rem;
    max-width: 25rem;
    max-height: 10rem;
    overflow: auto;
}
:deep(.sr-descr-style) {
    min-width: 5rem;
    max-width: 10rem;
    max-height: 15rem;
    overflow: auto;
    word-wrap: break-word; /* Ensure long words break properly */
    white-space: normal; /* Allow text to wrap */
    display: block;
}
:deep(.p-inputtext.p-component) {
    width: 100%;
    border: 1px solid var(--p-border-color);
}
:deep(.p-datatable .p-datatable-thead > tr > th) {
    min-width: 10px; /* Allow a minimum width for resizing */
    max-width: none;  /* Remove restrictions on maximum width */
    white-space: nowrap; /* Prevent headers from wrapping */
}


@media (max-width: 768px) {
    .sr-records-container {
        padding: 1rem;
        margin: 0.5rem;
    }
    .sr-descr-style {
        max-width: 8rem;
    }
}
</style>
