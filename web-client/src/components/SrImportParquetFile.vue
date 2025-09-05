<script setup lang="ts">
import { onMounted, ref } from 'vue';
import FileUpload from 'primevue/fileupload';
import ProgressBar from 'primevue/progressbar';
import Button from 'primevue/button';
import SrToast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { duckDbLoadOpfsParquetFile, readOrCacheSummary } from '@/utils/SrDuckDbUtils';
import { useRequestsStore } from '@/stores/requestsStore';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { db as indexedDb } from '@/db/SlideRuleDb';
import { createDuckDbClient } from '@/utils/SrDuckDb';
import type { SrRegion } from '@/types/SrTypes';
import type { ImportWorkerRequest, ImportWorkerResponse } from '@/types/SrImportWorkerTypes';
import SrImportWorker from '@/workers/SrImportWorker?worker'; 
import { addTimestampToFilename, getApiFromFilename } from '@/utils/SrParquetUtils';
import { updateNumGranulesInRecord, updateAreaInRecord } from '@/utils/SrParquetUtils'

const toast = useToast();

const props = defineProps({
    iconOnly: {
        type: Boolean,
        default: false
    }
});

export interface SvrParms {
    server: {
        rqst: {
            parms: {
                poly: SrRegion;
            };
        };
    };
}

const requestsStore = useRequestsStore();
const recTreeStore = useRecTreeStore();

const upload_progress_visible = ref(false);
const upload_progress = ref(0);
const tooltipRef = ref();
const fileUploader = ref<any>(null);

const emit = defineEmits<{
    (e: 'file-imported', reqId: string): void;
}>();

onMounted(() => {
    console.log('onMounted fileUploader:', fileUploader.value);
});



const customUploader = async (event: any) => {
    const file = event.files?.[0];
    if (!file) {
        toast.add({
            severity: 'error',
            summary: 'No File Selected',
            detail: 'Please select a valid Parquet file.',
            life: 4000
        });
        return;
    }

    try {
        upload_progress.value = 10;
        toast.removeGroup('headless'); // just in case a stale one is lingering
        toast.add({
            severity: 'info',
            summary: 'Uploading File',
            detail: 'SlideRule Parquet file is being uploaded...',
            group: 'headless',
            life: 999999,
            data: { progressRef: upload_progress }  // <-- pass progressRef
        } as any);

        // Start the Worker immediately
        const worker = new SrImportWorker();
        const fileBuffer = await file.arrayBuffer();
        const promise = new Promise<ImportWorkerResponse>((resolve, reject) => {
            worker.onmessage = (e: MessageEvent<ImportWorkerResponse | { progress: number; error?: string }>) => {
                const data = e.data;
                if ('progress' in data) {
                    // live progress update
                    upload_progress.value = Math.round(data.progress);
                } else if ('status' in data) {
                    if (data.status === 'error') {
                        reject(new Error(data.message || 'Worker error'));
                    } else {
                        resolve(data);
                    }
                }
            };
        });

        
        const newFilename = addTimestampToFilename(file.name);
        const msg: ImportWorkerRequest = {
            fileName: file.name,
            newFileName: newFilename,
            fileBuffer,
        };

        worker.postMessage(msg);

        let result: ImportWorkerResponse;
        try {
            result = await promise;
        } finally {
            worker.terminate(); // Always terminate even on error
        }

        const opfsRoot = await navigator.storage.getDirectory();
        const directoryHandle = await opfsRoot.getDirectoryHandle('SlideRule');
        const fileHandle = await directoryHandle.getFileHandle(newFilename);
        const opfsFile = await fileHandle.getFile();

        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(newFilename, 'SlideRule');

        const metadata = await duckDbClient.getAllParquetMetadata(opfsFile.name);
        //console.log('customUploader metadata:', metadata);

        if (!metadata || !('sliderule' in metadata)) {
            toast.add({
                severity: 'error',
                summary: 'Invalid File Format',
                detail: 'The selected file does not contain SlideRule metadata and cannot be imported.',
                life: 5000
            });
            await directoryHandle.removeEntry(opfsFile.name);
            return;
        }
        if (!('meta' in metadata)) {
            toast.add({
                severity: 'warn',
                summary: 'Incomplete File Format',
                detail: 'The selected file does not contain SlideRule "meta" field in the metadata and may not be able to be imported. Will try filename fallback.',
                life: 5000
            });
            await directoryHandle.removeEntry(opfsFile.name);
            return;
        }

        if ('geo' in metadata) {
            toast.add({
                severity: 'error',
                summary: 'Unsupported File Format',
                detail: `The selected file: ${opfsFile.name} is a SlideRule "geo" parquet file. At this time only SlideRule "vanilla" parquet files can be imported.`,
            });
            await directoryHandle.removeEntry(opfsFile.name);
            return;
        }

        upload_progress.value = 30;
        const srReqRec = await requestsStore.createNewSrRequestRecord();

        if (!srReqRec || !srReqRec.req_id) {
            alert('Failed to create new SlideRule request record');
            return;
        }


        try {
            const metaRaw = metadata.meta;
            const metaObj = typeof metaRaw === 'string'
                ? JSON.parse(metaRaw)
                : metaRaw;
            //console.log('customUploader metaObj:', metaObj);
            srReqRec.func = metaObj?.endpoint;
            srReqRec.parameters = metaObj?.request;
            if (!srReqRec.func) {
                const api = getApiFromFilename(opfsFile.name);
                srReqRec.func = api.func;
            }
            if (!srReqRec.func) {
                throw new Error('Function not found in SlideRule metadata and fallback to filename failed');
            }
            const hasFit = metaObj?.request?.fit;
            const hasPhoReal = metaObj?.request?.phoreal;
            //append suffixes if present
            if (hasFit) {
                srReqRec.func += '-surface';
            }
            if (hasPhoReal) {
                srReqRec.func += '-phoreal';
            }
        } catch (e) {
            toast.add({
                severity: 'error',
                summary: 'Metadata Error',
                detail: 'Unable to parse SlideRule metadata. File may be corrupted.',
                life: 4000
            });
            console.error('Error parsing SlideRule metadata:', e);
            return;
        }

        srReqRec.file = opfsFile.name;
        srReqRec.status = 'imported';
        srReqRec.description = `Imported from SlideRule Parquet File ${file.name}`;

        srReqRec.num_bytes = opfsFile.size;

        upload_progress.value = 60;

        const svr_parms_str = await duckDbLoadOpfsParquetFile(newFilename);
        srReqRec.svr_parms = svr_parms_str;

        await indexedDb.updateRequestRecord(srReqRec, true);
        await recTreeStore.updateRecMenu('From customUploader', srReqRec.req_id);
        await readOrCacheSummary(srReqRec.req_id);
        await updateAreaInRecord(srReqRec.req_id);
        await updateNumGranulesInRecord(srReqRec.req_id);
        const summary = await indexedDb.getWorkerSummary(srReqRec.req_id);
        if (summary) {
            srReqRec.cnt = summary.numPoints;
            await indexedDb.updateRequestRecord(srReqRec, true);

            upload_progress.value = 100;
            toast.add({
                severity: 'success',
                summary: 'Import Complete',
                detail: 'File imported and copied to OPFS successfully!',
                life: 5000
            });
            emit('file-imported', srReqRec.req_id.toString());
        } else {
            alert(`Failed to get summary for req_id: ${srReqRec.req_id}`);
        }
    } catch (error) {
        console.error('File import failed:', error);
        toast.add({
            severity: 'error',
            summary: 'Import Failed',
            detail: 'There was a problem importing the file.',
        });
    } finally {
        setTimeout(() => {
            upload_progress.value = 0;
            toast.removeGroup('headless');
        }, 2000);
    }
};

const onSelect = (e: any) => {
    console.log('onSelect e:', e);
};

const onError = (e: any) => {
    console.log('onError e:', e);
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
                            <ProgressBar :value="message.data.progressRef" :showValue="false" class="progress-bar" />
                            <label class="upload-percentage">{{ message.data.progressRef }}% uploaded...</label>
                        </div>
                        <div class="button-container">
                            <Button label="Done" text class="done-btn" @click="closeCallback"></Button>
                        </div>
                    </div>
                </section>
            </template>
        </SrToast>
        <div class="sr-file-import-panel">       
            <div class="sr-file-import-panel">
                <FileUpload 
                    ref="fileUploader"
                    v-show="false"
                    mode="basic"
                    name="SrFileUploadsImport[]"
                    :auto="true"
                    accept=".parquet"
                    :maxFileSize="10000000000"
                    customUpload
                    @uploader="customUploader"
                    @select="onSelect"
                    @error="onError"
                    @clear="onClear"
                />

                <Button
                    v-if="!props.iconOnly"
                    icon="pi pi-file-import"
                    class="sr-glow-button"
                    label="Import"
                    @mouseover="tooltipRef?.showTooltip($event, 'Import a parquet file')"
                    @mouseleave="tooltipRef?.hideTooltip()"
                    @click="fileUploader?.choose()"
                    aria-label="Import"
                    variant="text"
                    rounded
                />

                <Button
                    v-else
                    icon="pi pi-file-import"
                    class="sr-glow-button p-button-icon-only"
                    @mouseover="tooltipRef?.showTooltip($event, 'Import a parquet file')"
                    @mouseleave="tooltipRef?.hideTooltip()"
                    @click="fileUploader?.choose()"
                    aria-label="Import"
                    variant="text"
                    rounded
                />
            </div>
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



:deep(.p-icon) {
    color: var(--p-primary-color, white); /* fallback to white */
}

.p-button-sm .p-button-icon {
    font-size: var(--p-button-sm-font-size);
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
    color: var(--p-primary-color, white); /* fallback to white */
}

.p-button-sm .p-button-icon {
    font-size: var(--p-button-sm-font-size);
}

:deep(.pi-file-import) {
    color: var(--p-primary-color); 
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
