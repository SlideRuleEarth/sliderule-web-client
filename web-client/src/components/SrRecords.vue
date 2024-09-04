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
import { updateFilename } from '@/utils/SrParquetUtils';
import { duckDbReadOrCacheSummary } from '@/utils/SrDuckDbUtils';
import { getHeightFieldname } from '@/utils/SrParquetUtils';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';

const atlChartFilterStore = useAtlChartFilterStore();
const requestsStore = useRequestsStore();
const isCodeFormat = ref(true);


const onEditComplete = (data: Record<string, any>, field: string, event: Event) => {
    const inputElement = event.target as HTMLInputElement;
    const newValue = inputElement.value.trim();
    //data[field] = newValue; // Update the specific field with the new value
    db.updateRequestRecord({req_id: data.req_id, description: data.description});
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
        console.log('Delete ', id);
        const fn = await db.getFilename(id);
        await deleteOpfsFile(fn);
        requestsStore.deleteReq(id);
    } catch (error) {
        console.error(`Failed to delete request for id:${id}`, error);
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
    requestsStore.reqs.forEach(async (req) => {
        try {
            if (req.req_id) {
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
const confirmDeleteAllReqs = () => {
    const userConfirmed = window.confirm('Are you sure you want to delete all requests?');
    if (userConfirmed) {
        deleteAllReqs();
        console.log('Confirmed Delete all');
    } else {
        console.log('Deletion cancelled');
    }
};



const importFile = async () => {
    console.log('Importing file');
    try {
        // Step 1: Open file picker dialog for the user to select a file
        const [fileHandle] = await (window as any).showOpenFilePicker({
            types: [
                {
                    description: 'Parquet Files',
                    accept: {
                        'application/octet-stream': ['.parquet']
                    }
                }
            ],
            excludeAcceptAllOption: true,
            multiple: false
        });

        // Get the selected file
        const file = await fileHandle.getFile();

        // Step 2: Get access to the OPFS directory
        const opfsRoot = await navigator.storage.getDirectory();
        const folderName = 'SlideRule'; 
        const directoryHandle = await opfsRoot.getDirectoryHandle(folderName, { create: true }); // Create folder if not exists


        const srReqRec = await requestsStore.createNewSrRequestRecord();
        if(srReqRec && srReqRec.req_id) {
            const { func, newFilename } = updateFilename(srReqRec.req_id, file.name);
            srReqRec.file = newFilename;
            srReqRec.func = func;
            srReqRec.status = 'imported';
            srReqRec.description = `Imported from SlideRule Parquet File ${file.name}`;
            await db.updateRequestRecord(srReqRec);
            // Step 3: Create a file handle in the OPFS with the same name as the selected file
            const opfsFileHandle = await directoryHandle.getFileHandle(newFilename, { create: true });

            // Step 4: Write the contents of the selected file into the OPFS file
            const writableStream = await opfsFileHandle.createWritable();
            await writableStream.write(file);
            await writableStream.close();
            const heightFieldname = await getHeightFieldname(srReqRec.req_id);
            await duckDbReadOrCacheSummary(srReqRec.req_id, heightFieldname);
            const summary = await db.getWorkerSummary(srReqRec.req_id);
            console.log('Summary:', summary);
            if(summary){
                const opfsFile = await opfsFileHandle.getFile();
                srReqRec.num_bytes  = opfsFile.size;
                srReqRec.cnt = summary.numPoints;
                await db.updateRequestRecord(srReqRec); 
                const msg = `File imported and copied to OPFS successfully!`;
                console.log(msg);
                alert(msg);
            } else {
                console.error(`Failed to get summary for req_id: ${srReqRec.req_id}`);
                alert(`Failed to get summary for req_id: ${srReqRec.req_id}`);
            }
        } else {
            console.error(`Failed File create new SlideRule request record`);
            alert(`Failed to import File. Unable to create new SlideRule request record`);
        }
    } catch (error) {
        console.error(`Failed to import and copy file`, error);
        alert(`Failed to import and copy file`);
        throw error;
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
</script>

<template>
    <div class="sr-records-container">
        <DataTable 
            :value="requestsStore.reqs" 
            tableStyle="min-width: 50rem" 
            scrollable 
            scrollHeight="50rem"
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
                    <span v-tooltip="slotProps.data.status_details">
                        {{ slotProps.data.status }}
                    </span>
                </template>
            </Column>
            <Column field="func" header="Function"></Column>
            <Column field="description" header="Description" :editable="true">
                <template #editor="{ data }">
                    <InputText
                        v-model="data.description"
                        class="p-inputtext p-component"
                        @keydown.enter="(event) => onEditComplete(data, 'description', event)"
                        @blur="(event) => onEditComplete(data, 'description', event)"
                    />
                </template>
            </Column>
            <Column field="parameters" header="Parameters" class="sr-par-fmt">
                <template #header>
                    <i 
                      class="pi pi-code sr-toggle-icon"
                      @click="isCodeFormat = !isCodeFormat"
                      v-tooltip="'Toggle code format'"
                    > </i>
                </template> 
                <template #body="slotProps">
                    <div class="sr-col-par-style" >
                        <span v-if="isCodeFormat"><pre><code>{{slotProps.data.parameters}}</code></pre></span>
                        <span v-else>{{slotProps.data.parameters}}</span>
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
            <Column field="Actions" header="" class="sr-analyze">
                <template #body="slotProps">
                    <i 
                      class="pi pi-chart-line"
                      v-if="((slotProps.data.status == 'success') || (slotProps.data.status == 'imported'))"
                      @click="analyze(slotProps.data.req_id)"
                      v-tooltip="'Analyze'"
                    ></i>
                </template>
            </Column>
            <Column field="Actions" header="" class="sr-src-code">
                <template #body="slotProps">
                    <i 
                      class="pi pi-calculator sr-calculator-icon"
                      v-if="findParam(slotProps.data.parameters, 'with_checksum')"
                      @click="calculateCS(slotProps.data.req_id)"
                      v-tooltip="'Verify Checksum'"
                    ></i>
                </template>
            </Column>
            <Column field="Actions" header="" class="sr-delete">
                <template #header>
                    <i 
                      class="pi pi-trash"
                      @click="confirmDeleteAllReqs()"
                      v-tooltip="'Delete ALL reqs'"
                    ></i>
                </template>
                <template #body="slotProps">
                    <i 
                      class="pi pi-trash"
                      @click="deleteReq(slotProps.data.req_id)"
                      v-tooltip="'Delete req'"
                    ></i>
                </template>
            </Column>
            <Column field="Actions" header="" class="sr-export">
                <template #header>
                    <i 
                      class="pi pi-file-import sr-file-import-icon"
                      @click="importFile()"
                      v-tooltip="'Import a SlideRule Parquet File'"
                    ></i>
                </template>
                <template #body="slotProps">
                    <i 
                      class="pi pi-file-export sr-file-export-icon"
                      @click="exportFile(slotProps.data.req_id)"
                      v-tooltip="'Export file'"
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
    min-width: 20rem;
    max-width: 25rem;
    max-height: 10rem;
    overflow: auto;
    overflow-x: auto;
}
</style>
