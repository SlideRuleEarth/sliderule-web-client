<script setup lang="ts">
import { ref } from 'vue';
import FileUpload from 'primevue/fileupload';
import ProgressBar from 'primevue/progressbar';
import Button from 'primevue/button';
import SrToast from 'primevue/toast';
import { useToast } from "primevue/usetoast";
import { updateFilename } from '@/utils/SrParquetUtils';
import { duckDbLoadOpfsParquetFile,readOrCacheSummary } from '@/utils/SrDuckDbUtils';
import { getHFieldNameForFuncStr } from '@/utils/SrDuckDbUtils';
import { useRequestsStore } from '@/stores/requestsStore'; 
import { useRecTreeStore } from '@/stores/recTreeStore';
import { db } from '@/db/SlideRuleDb';
import type { SrRegion } from '@/sliderule/icesat2'


export interface SvrParms { // fill this out as neccessary
    server: {
        rqst: {
            parms: {
                poly: SrRegion;
            }
        }
    }
}
const requestsStore = useRequestsStore();
const recTreeStore = useRecTreeStore();
const toast = useToast();

////////////// upload toast items
const upload_progress_visible = ref(false);
const upload_progress = ref(0);
//////////////




const customUploader = async (event:any) => {
    //console.log('customUploader Import Parquet File customUploader event:',event);
     try {
        // Step 1: Open file picker dialog for the user to select a file
        const file = event.files[0];
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
            const opfsFile = await opfsFileHandle.getFile();
            srReqRec.num_bytes  = opfsFile.size;
            const svr_parms_str = await duckDbLoadOpfsParquetFile(newFilename);
            srReqRec.svr_parms = svr_parms_str;
            console.log('customUploader srReqRec:', srReqRec);
            await db.updateRequestRecord(srReqRec); 
            // console.log('Updated srReqRec:', srReqRec);
            // console.log('svr_parms:', svr_parms);
            await recTreeStore.updateRecMenu('From customUploader',srReqRec.req_id);// update the menu to include new item
            await readOrCacheSummary(srReqRec.req_id);
            const summary = await db.getWorkerSummary(srReqRec.req_id);
            console.log('Summary:', summary);
            if(summary){
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

const onSelect = (e:any) => {
    console.log('onSelect e:',e);
};

const onError = (e:any) => {
    console.log('onError e:',e);
    toast.add({ severity: 'error', summary: 'Upload Error', detail: 'Error uploading file', group: 'headless' });
};
const onClear = () => {
    console.log('onClear');
};

</script>

<template>
    <div class="file-upload-panel">
        <SrToast position="top-center" group="headless" @close="upload_progress_visible = false">
            <template #container="{ message, closeCallback }">
                <section class="toast-container">
                    <i class="upload-icon"></i>
                    <div class="message-container">
                        <p class="summary">{{ message.summary }}</p>
                        <p class="detail">{{ message.detail }}</p>
                        <div class="progress-container">
                            <ProgressBar :value="upload_progress" :showValue="false" class="progress-bar"></ProgressBar>
                            <label class="upload-percentage">{{ upload_progress }}% uploaded...</label>
                        </div>
                        <div class="button-container">
                            <Button label="Done" text class="done-btn" @click="closeCallback"></Button>
                        </div>
                    </div>
                </section>
            </template>
        </SrToast>
        <div class="sr-file-import-panel">       
            <FileUpload mode="basic" 
                        name="SrFileUploadsImport[]"
                        chooseLabel="Imp"
                        class="p-button-icon-only p-button-text p-button-sm"
                        chooseIcon="pi pi-file-import"
                        :auto="true" 
                        accept=".parquet" 
                        :maxFileSize="10000000000" 
                        customUpload 
                        @uploader="customUploader"
                        @select="onSelect"
                        @error="onError"
                        @clear="onClear"
            />
        </div>
    </div>
</template>

<style scoped>

.file-upload-panel { 
    display: flex;
    justify-content: left;
    align-items: center;
}

.sr-file-import-panel { 
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0;
}   


:deep(.p-button.p-component.p-fileupload-choose-button.p-button-icon-only.p-button-text.p-button-sm ){
    padding: 0;
    display: block;
    text-align: left;
}

:deep(.p-progressbar-label){
    color: var(--p-text-color);
}
.toast-container {
    display: flex;
    padding: 1rem; /* 12px 3rem in bootstrap, adjust accordingly */
    gap: 1rem; /* adjust as needed */
    width: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    border-radius: var(--p-border-radius);
}

.upload-icon {
    /* Styles for pi pi-cloud-upload */
    color: var(--p-primary-color); /* primary-500 color  #2c7be5;*/
    font-size: 1.5rem; /* 2xl size */
}

:deep(.p-icon) {
    color: white; /* Changes the icon color to white */
}
.p-button-sm .p-button-icon {
    font-size: var(--p-button-sm-font-size);
}

:deep(.pi-file-import) {
    color: white; /* Changes the icon color to white */
}

.message-container {
    display: flex;
    flex-direction: column;
    gap: 1rem; /* adjust as needed */
    width: 100%;
}

.summary, .detail {
    margin: 0;
    font-weight: 600; /* font-semibold */
    font-size: 1rem; /* text-base */
    color: #ffffff;
}

.detail {
    color: var(--p-text-color); /* text-700 color, adjust as needed */
}

.progress-container {
    display: flex;
    flex-direction: column;
    gap: 8px; /* adjust as needed */
}

.progress-bar {
    height: 4px;
}

.upload-percentage {
    text-align: right;
    font-size: 0.75rem; /* text-xs */
    color:var(--p-text-color);
}
.sr-file-import-panel .pi-file-import {
    color: white; 
}
</style>
