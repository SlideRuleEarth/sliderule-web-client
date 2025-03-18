<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import TreeTable from 'primevue/treetable';
import Column from 'primevue/column';
import type { TreeNode } from 'primevue/treenode';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
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
                    class="p-button-text" 
                    @click="analyze(slotProps.node.data.reqId)"
                    @mouseover="tooltipRef?.value?.value?.showTooltip($event, `Analyze ${slotProps.node.data.reqId}`)"
                    @mouseleave="tooltipRef?.value?.value?.hideTooltip"
                ></Button>
            </template>
        </Column>

        <!-- Editable Description -->
        <Column field="description" header="Description" :editable="true" style="width: 15rem; max-width: 20rem;">
            <template #header>
                <i 
                  class="pi pi-pencil"
                  @mouseover="tooltipRef?.value?.showTooltip($event, 'Editable Description')"
                  @mouseleave="tooltipRef?.value?.hideTooltip"
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
                  class="p-button-text" 
                  @click="openParmsDialog(slotProps.node.data.parameters)"
                  @mouseover="tooltipRef?.value?.showTooltip($event, 'View Request Parameters')"
                  @mouseleave="tooltipRef?.value?.hideTooltip"
                ></Button>
            </template>
        </Column>

        <!-- Server Parameters Button & Dialog -->
        <Column field="svr_parms" header="Svr Parms" class="sr-par-fmt">
            <template #body="slotProps">
                <Button 
                  icon="pi pi-eye" 
                  label="View" 
                  class="p-button-text" 
                  @click="openSvrParmsDialog(slotProps.node.data.svr_parms)"
                  @mouseover="tooltipRef?.value?.showTooltip($event, 'View Server Parameters')"
                  @mouseleave="tooltipRef?.value?.hideTooltip"
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

        <Column field="Actions" header="" class="sr-delete">
            <template #header>
                <Button 
                    icon="pi pi-trash"
                    class="p-button-text" 
                    @click="confirmDeleteAllReqs()"
                    @mouseover="tooltipRef?.value?.showTooltip($event, 'Delete ALL Requests')"
                    @mouseleave="tooltipRef?.value?.hideTooltip"
                ></Button>
            </template>
            <template #body="slotProps">
                <Button 
                    icon="pi pi-trash"
                    class="p-button-text"
                    @click="deleteReqAndChildren(slotProps.node.data.reqId)"
                    @mouseover="tooltipRef?.value?.showTooltip($event, 'Delete this request and any of its children')"
                    @mouseleave="tooltipRef?.value?.hideTooltip"
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

.error-message {
    color: red;
    font-size: 1.5rem;
    margin-top: 1rem;
}
</style>
