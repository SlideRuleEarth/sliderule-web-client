<script setup lang="ts">

import TreeTable from 'primevue/treetable';
import { type TreeNode } from 'primevue/treenode';
import Column from 'primevue/column';
import { useRequestsStore } from "@/stores/requestsStore";
import { onMounted,onUnmounted,ref } from 'vue';
import { formatBytes } from '@/utils/SrParquetUtils';
import SrCustomTooltip from './SrCustomTooltip.vue';
import { useRecTreeStore } from "@/stores/recTreeStore";
import router from '@/router/index';
import { useToast } from "primevue/usetoast";
import { useSrToastStore } from "@/stores/srToastStore";
import { deleteOpfsFile } from '@/utils/SrParquetUtils';
import { db } from '@/db/SlideRuleDb';
import { cleanupAllRequests } from '@/utils/storageUtils';
import SrEditDesc from './SrEditDesc.vue';

const requestsStore = useRequestsStore();
const recTreeStore = useRecTreeStore();
const treeNodes = ref<TreeNode[]>([]);
const tooltipRef = ref();
const toast = useToast();
const srToastStore = useSrToastStore();

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
    treeNodes.value = await requestsStore.getTreeTableNodes();
    await recTreeStore.loadTreeData();
    recTreeStore.initToFirstRecord();
    return deleteSuccessful;
}

const deleteAllReqs = async () => {
    console.log('deleteAllReqs');
    cleanupAllRequests();
    treeNodes.value = await requestsStore.getTreeTableNodes();
    await recTreeStore.loadTreeData();
    recTreeStore.initToFirstRecord();
};

const confirmDeleteAllReqs = async () => {
    const userConfirmed = window.confirm('Are you sure you want to delete all requests?');
    if (userConfirmed) {
        await deleteAllReqs();
        console.log('Confirmed Delete all');
    } else {
        console.log('Deletion cancelled');
    }
};


const onEditComplete = async (data: Record<string, any>, field: string, event: Event) => {
    const inputElement = event.target as HTMLInputElement;
    const newValue = inputElement.value.trim();
    //data[field] = newValue; // Update the specific field with the new value
    await db.updateRequestRecord({req_id: data.reqId, description: data.description}, false);
    // Re-fetch from the DB so that treeNodes.value reflects the updated DB record.
    treeNodes.value = await requestsStore.getTreeTableNodes();
    console.log('Edit completed:', field, 'New Value:', newValue, 'Data:', data);
};

onMounted(async () => {
    requestsStore.watchReqTable();
    treeNodes.value = await requestsStore.getTreeTableNodes();
    console.log('SrRecTree onMounted treeNodes:', treeNodes.value);

});

onUnmounted(() => {
    requestsStore.unWatchReqTable();
});
</script>

<template>
    <TreeTable 
        :value="treeNodes" 
        :paginator="true"
        :rows="3"
        :rowsPerPageOptions="[3,5,10,20]"
    >
        <Column expander style="width: 1rem" />
        <Column field="reqId" header="ID"  />
        <Column field="func" header="Api"  />
        <Column field="status" header="Status"  />
        <Column field="Actions" header="Analyze" class="sr-analyze">
            <template #body="slotProps">
                <i 
                    class="pi pi-chart-line"
                    v-if="((slotProps.node.data.status == 'success') || (slotProps.node.data.status == 'imported'))"
                    @click="analyze(slotProps.node.data.reqId)"
                    @mouseover="tooltipRef.showTooltip($event, `Analyze ${slotProps.node.data.reqId}`)"
                    @mouseleave="tooltipRef.hideTooltip"
                ></i>
            </template>
        </Column>
        <Column field="description" header="Description" :editable="true" style="width: 15rem; max-width: 20rem;">
            <template #header>
                <i 
                    class="pi pi-pencil"
                    @mouseover="tooltipRef.showTooltip($event, 'Editable Description')"
                    @mouseleave="tooltipRef.hideTooltip"
                ></i>
            </template>
            <template #body="slotProps">
                <SrEditDesc :reqId="slotProps.node.data.reqId" label=""/>
            </template>
        </Column>
        <Column field="parameters" header="Req Parms" class="sr-par-fmt">
                <template #header>
                    <i 
                      class="pi pi-code sr-toggle-icon"
                      @mouseover="tooltipRef.showTooltip($event, 'Toggle Code Format')"
                      @mouseleave="tooltipRef.hideTooltip"
                    > </i>
                </template> 
                <template #body="slotProps">
                    <div class="sr-col-par-style" >
                        <span><pre><code>{{slotProps.node.data.parameters}}</code></pre></span>
                    </div>
                </template>
            </Column>
            <Column field="svr_parms" header="Svr Parms" class="sr-par-fmt">
                <template #header>
                    <i 
                      class="pi pi-code sr-toggle-icon"
                      @mouseover="tooltipRef.showTooltip($event, 'Toggle Code Format')"
                      @mouseleave="tooltipRef.hideTooltip"
                    > </i>
                </template> 
                <template #body="slotProps">
                    <div class="sr-col-par-style" >
                        <span><pre><code>{{slotProps.node.data.svr_parms}}</code></pre></span>
                    </div>
                </template>
            </Column>
        <Column field="cnt" header="Count">
            <template #body="slotProps">
                {{ new Intl.NumberFormat().format(parseInt(String(slotProps.node.data.cnt)))  }}
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
                      @click="deleteReqAndChildren(slotProps.node.data.reqId)"
                      @mouseover="tooltipRef.showTooltip($event, 'Delete this request and any of its children')"
                      @mouseleave="tooltipRef.hideTooltip"
                    ></i>
                </template>
            </Column>
    </TreeTable>
    <SrCustomTooltip ref="tooltipRef"/>
    <!-- Display an error message if there is an error -->
    <div v-if="requestsStore.autoFetchError" class="error-message">
        {{ requestsStore.autoFetchErrorMsg }}
    </div>
</template>

<style scoped>

.sr-par-fmt {
    margin-left: 1rem;
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

:deep(.sr-col-par-style) {
    width: 10rem;
    min-width: 7rem;
    max-width: 25rem;
    max-height: 10rem;
    overflow: auto;
}

.error-message {
    color: red;
    font-size: 1.5rem;
    margin-top: 1rem;
}
</style>