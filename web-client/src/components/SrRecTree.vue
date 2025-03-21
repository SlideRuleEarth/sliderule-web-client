<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import TreeTable from 'primevue/treetable';
import Column from 'primevue/column';
import type { TreeNode } from 'primevue/treenode';
import Button from 'primevue/button';
import { useToast } from "primevue/usetoast";

import { useRequestsStore } from "@/stores/requestsStore";
import { useRecTreeStore } from "@/stores/recTreeStore";
import { db } from '@/db/SlideRuleDb';
import router from '@/router/index';
import { deleteOpfsFile } from '@/utils/SrParquetUtils';
import { cleanupAllRequests } from '@/utils/storageUtils';
import SrCustomTooltip from './SrCustomTooltip.vue';
import SrEditDesc from './SrEditDesc.vue';
import { useSrToastStore } from "@/stores/srToastStore";
import { formatBytes } from '@/utils/SrParquetUtils';
import SrJsonDisplayDialog from './SrJsonDisplayDialog.vue';
import SrImportParquetFile from './SrImportParquetFile.vue';

const requestsStore = useRequestsStore();
const recTreeStore = useRecTreeStore();
const srToastStore = useSrToastStore();
const toast = useToast();

const treeNodes = ref<TreeNode[]>([]);
const tooltipRef = ref();

// -- Dialog state for "parameters"
const showParmsDialog = ref(false);
const currentParms = ref('');

// -- Dialog state for "svr_parms"
const showSvrParmsDialog = ref(false);
const currentSvrParms = ref('');


// Open the Req Parms dialog
function openParmsDialog(params: string | object) {
  if (typeof params === 'object') {
    currentParms.value = JSON.stringify(params, null, 2);
  } else {
    currentParms.value = params;
  }
  showParmsDialog.value = true;
}

// Open the Svr Parms dialog
function openSvrParmsDialog(params: string | object) {
  if (typeof params === 'object') {
    currentSvrParms.value = JSON.stringify(params, null, 2);
  } else {
    currentSvrParms.value = params;
  }
  showSvrParmsDialog.value = true;
}

const analyze = async (id:number) => {
    try {
        if(recTreeStore.findAndSelectNode(id)){
            router.push(`/analyze/${id.toString()}`);
        } else {
            toast.add({ severity: 'error', summary: 'Invalid Record Id', detail: 'Failed to set record Id', life: srToastStore.getLife() });
        }
    } catch (error) {
        console.error(`Failed to analyze request for id:${id}`, error);
        throw error;
    }
};

async function deleteRequest(id:number){
    let deleted = true;
    try {
        const fn = await db.getFilename(id);
        await deleteOpfsFile(fn);
    } catch (error) {
        console.error(`Failed to delete file for id:${id}`, error);
        deleted = false;
    }
    try {
        deleted = await requestsStore.deleteReq(id);
        if (deleted) {
            toast.add({ severity: 'success', summary: 'Record Deleted', detail: `Record ${id} deleted successfully`, life: srToastStore.getLife() });
        } else {
            toast.add({ severity: 'error', summary: 'Record Deletion Failed', detail: `Failed to delete record ${id}`, life: srToastStore.getLife() });
        }
    } catch (error) {
        console.error(`Failed to delete record for id:${id}`, error);
        deleted = false;
    }
    return deleted;
};

const deleteReqAndChildren = async (id:number) => {
    const children = await db.runContexts.where('parentReqId').equals(id).toArray();
    const listOfChildIds = children.map(child => child.reqId);
    let msg = `Are you sure you want to delete this record ${id}`;
    if(children.length > 0) {
        msg += ` and all its children: ${listOfChildIds}`;
    }

    const userConfirmed = window.confirm(msg);
    let deleteSuccessful = true;
    if (userConfirmed) {
        if (children.length > 0) {
            for (const child of children) {
                deleteSuccessful = deleteSuccessful && (await deleteRequest(child.reqId));
            }
        }
        deleteSuccessful = deleteSuccessful && (await deleteRequest(id));
    } else {
        toast.add({ severity: 'warn', summary: 'Deletion Cancelled', detail: `Record ${id} was NOT deleted`, life: srToastStore.getLife() });
        return false;
    }
    if (!deleteSuccessful) {
        toast.add({ severity: 'error', summary: 'Record Deletion Failed', detail: `Failed to delete record ${id}`, life: srToastStore.getLife() });
    }
    treeNodes.value = await requestsStore.getTreeTableNodes();
    await recTreeStore.loadTreeData();
    recTreeStore.initToFirstRecord();
    return deleteSuccessful;
};

const deleteAllReqs = async () => {
    cleanupAllRequests();
    treeNodes.value = await requestsStore.getTreeTableNodes();
    await recTreeStore.loadTreeData();
    recTreeStore.initToFirstRecord();
};

const confirmDeleteAllReqs = async () => {
    const userConfirmed = window.confirm('Are you sure you want to delete all requests?');
    if (userConfirmed) {
        await deleteAllReqs();
    }
};

async function copyToClipboard(content: string, label: string = 'Content') {
  try {
    await navigator.clipboard.writeText(content);
    toast.add({ severity: 'success', summary: `${label} Copied`, detail: `${label} copied to clipboard.`, life: srToastStore.getLife() });
  } catch (err) {
    console.error('Failed to copy content:', err);
    toast.add({ severity: 'error', summary: 'Copy Failed', detail: `Unable to copy ${label}`, life: srToastStore.getLife() });
  }
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

const handleFileImported = async (reqId: string) => {
    console.log('File import completed. Request ID:', reqId);
    treeNodes.value = await requestsStore.getTreeTableNodes();
};


onMounted(async () => {
    requestsStore.watchReqTable();
    treeNodes.value = await requestsStore.getTreeTableNodes();
    console.log('treeNodes.value:', treeNodes.value);
});

onUnmounted(() => {
    requestsStore.unWatchReqTable();
});
</script>

<template>
    <TreeTable 
      :value="treeNodes"
      size="small" 
      :paginator="true"
      :rows="10"
      :rowsPerPageOptions="[3,5,10,15,20,25,50]"
    >
        <Column field="reqId" header="ID" expander />
        <Column field="func" header="Api" />
        <Column field="status" header="Status" />

        <Column field="Actions" header="Analyze" class="sr-analyze">
            <template #body="slotProps">
                <Button 
                    v-if="slotProps.node.data.status === 'success' || slotProps.node.data.status === 'imported'"
                    icon="pi pi-chart-line"
                    class="sr-glow-button p-button-icon-only"
                    @click="analyze(slotProps.node.data.reqId)"
                    @mouseover="tooltipRef?.showTooltip($event, `Analyze ${slotProps.node.data.reqId}`)"
                    @mouseleave="tooltipRef?.hideTooltip"
                    variant="text"
                    rounded
                ></Button>
            </template>
        </Column>

        <!-- Editable Description -->
        <Column field="description" header="Description" :editable="true" style="width: 15rem; max-width: 20rem;">
            <template #header>
                <i 
                  class="pi pi-pencil"
                  @mouseover="tooltipRef?.showTooltip($event, 'Editable Description')"
                  @mouseleave="tooltipRef?.hideTooltip"
                ></i>
            </template>
            <template #body="slotProps">
                <SrEditDesc :reqId="slotProps.node.data.reqId" label=""/>
            </template>
        </Column>

        <!-- Request Parameters Button & Dialog -->
        <Column field="parameters" header="Req Parms" class="sr-par-fmt">
            <template #body="slotProps">
                <Button 
                    icon="pi pi-eye" 
                    label="View" 
                    class="sr-glow-button"
                    @click="openParmsDialog(slotProps.node.data.parameters)"
                    @mouseover="tooltipRef?.showTooltip($event, 'View Request Parameters')"
                    @mouseleave="tooltipRef?.hideTooltip"
                    variant="text"
                    rounded
                ></Button>
            </template>
        </Column>

        <!-- Server Parameters Button & Dialog -->
        <Column field="svr_parms" header="Svr Parms" class="sr-par-fmt">
            <template #body="slotProps">
                <Button 
                    icon="pi pi-eye" 
                    label="View" 
                    class="sr-glow-button"
                    @click="openSvrParmsDialog(slotProps.node.data.svr_parms)"
                    @mouseover="tooltipRef?.showTooltip($event, 'View Server Parameters')"
                    @mouseleave="tooltipRef?.hideTooltip"
                    variant="text"
                    rounded
                ></Button>
            </template>
        </Column>

        <Column field="cnt" header="Count">
            <template #body="slotProps">
                {{ new Intl.NumberFormat().format(parseInt(String(slotProps.node.data.cnt))) }}
            </template>
        </Column>
        <Column field="num_bytes" header="Size">
            <template #body="slotProps">
                {{ formatBytes(slotProps.node.data.num_bytes) }}
            </template>
        </Column>
        <Column field="elapsed_time" header="Elapsed Time" style="width: 10%" />
        <Column field="Actions" header="" class="sr-export">
            <template #header>
                <div 
                    class="sr-file-import"
                    @mouseover="tooltipRef.showTooltip($event, 'Import a SlideRule Parquet File')" 
                    @mouseleave="tooltipRef.hideTooltip"
                >
                    <SrImportParquetFile :iconOnly="true" @file-imported="handleFileImported" />
                </div>
            </template>
            <template #body="slotProps">
                <Button
                    icon="pi pi-file-export"
                    class="sr-glow-button p-button-icon-only"
                    @click="exportFile(slotProps.node.data.reqId)"
                    @mouseover="tooltipRef?.showTooltip($event, 'Export File')"
                    @mouseleave="tooltipRef?.hideTooltip"
                    aria-label="Export"
                    variant="text"
                    rounded
                />                
            </template>
        </Column>

        <Column field="Actions" header="" class="sr-delete">
            <template #header>
                <Button 
                    icon="pi pi-trash"
                    class="sr-glow-button p-button-icon-only"
                    @click="confirmDeleteAllReqs()"
                    @mouseover="tooltipRef?.showTooltip($event, 'Delete ALL Requests')"
                    @mouseleave="tooltipRef?.hideTooltip"
                    variant="text"
                    rounded
                ></Button>
            </template>
            <template #body="slotProps">
                <Button 
                    icon="pi pi-trash"
                    class="sr-glow-button p-button-icon-only"
                    @click="deleteReqAndChildren(slotProps.node.data.reqId)"
                    @mouseover="tooltipRef?.showTooltip($event, 'Delete this request and any of its children')"
                    @mouseleave="tooltipRef?.hideTooltip"
                    variant="text"
                    rounded
                ></Button>
            </template>
        </Column>
    </TreeTable>

    <!-- Request Parameters Dialog -->
    <SrJsonDisplayDialog
        v-model:visible="showParmsDialog"
        :json-data="currentParms"
        title="Request Parameters"
        width="50vw"
    />
    <!-- Server Parameters Dialog -->
    <SrJsonDisplayDialog
        v-model:visible="showSvrParmsDialog"
        :json-data="currentSvrParms"
        title="Server Parameters"
        width="50vw"
    />
    <!-- Custom Tooltip -->
    <SrCustomTooltip ref="tooltipRef"/>

    <!-- Display an error message if there is an error -->
    <div v-if="requestsStore.autoFetchError" class="error-message">
        {{ requestsStore.autoFetchErrorMsg }}
    </div>
</template>

<style scoped>

:deep(.p-icon) {
    color: var(--p-primary-color, white); /* fallback to white */
}

.p-button-sm .p-button-icon {
    font-size: var(--p-button-sm-font-size);
}


.error-message {
    color: red;
    font-size: 1.5rem;
    margin-top: 1rem;
}
</style>
