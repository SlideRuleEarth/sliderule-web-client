<script setup lang="ts">
import { onMounted, ref } from 'vue';
import FileUpload from 'primevue/fileupload';
import ProgressBar from 'primevue/progressbar';
import Button from 'primevue/button';
import SrToast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { duckDbLoadOpfsParquetFile, readOrCacheSummary, getGeoMetadataFromFile } from '@/utils/SrDuckDbUtils';
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
const upload_status = ref<'idle' | 'uploading' | 'aborted' | 'error' | 'success'>('idle');

const emit = defineEmits<{
    (e: 'file-imported', reqId: string): void;
}>();

onMounted(() => {
    console.log('onMounted fileUploader:', fileUploader.value);
});

const activeWorker = ref<Worker | null>(null);
const activeNewFilename = ref<string | null>(null);
const isBusy = ref(false);


// cancel button handler
function cancelUpload() {
  if (activeWorker.value) {
    upload_status.value = 'aborted';     // ⬅️ flip to aborted state (visible ✕)
    upload_progress.value = 0;           // ⬅️ force bar to zero so “✕ canceled” shows
    try { activeWorker.value.postMessage({ type: 'cancel' }); } catch {}
  }
}

// Optional: helper to remove a file if we fail AFTER the worker succeeded
async function tryRemoveOpfsFile(filename: string) {
  try {
    const root = await navigator.storage.getDirectory();
    const dir  = await root.getDirectoryHandle('SlideRule');
    await dir.removeEntry(filename);
  } catch {
    // ignore
  }
}


const customUploader = async (event: any) => {
  const file = event.files?.[0];
  if (!file) {
    toast.add({ severity: 'error', summary: 'No File Selected', detail: 'Please select a valid Parquet file.', life: 4000 });
    return;
  }

  isBusy.value = true;
  let worker: Worker | null = null;
  let newFilename = addTimestampToFilename(file.name);
  activeNewFilename.value = newFilename;

  try {
    upload_progress.value = 10;
    toast.removeGroup('headless');
    toast.add({
      severity: 'info',
      summary: 'Uploading File',
      detail: 'SlideRule Parquet file is being uploaded...',
      group: 'headless',
      life: 999999,
      data: { progressRef: upload_progress, statusRef: upload_status }
    } as any);

    // Start worker
    worker = new SrImportWorker();
    activeWorker.value = worker;

    const promise = new Promise<ImportWorkerResponse>((resolve, reject) => {
      worker!.onmessage = (e: MessageEvent<ImportWorkerResponse | { progress: number }>) => {
        const data = e.data as any;
        if ('progress' in data) {
          upload_progress.value = Math.round(data.progress);
        } else if ('status' in data) {
          if (data.status === 'error') reject(new Error(data.message || 'Worker error'));
          else resolve(data); // ok or aborted
        }
      };
      worker!.onerror = (err) => reject(err);
    });

    worker.postMessage(<ImportWorkerRequest>{
      fileName: file.name,
      newFileName: newFilename,
      file,
      fileSize: file.size
    });

    const result = await promise;

    // If aborted by user – just stop and show a gentle toast
    if (result.status === 'aborted') {
        upload_status.value = 'aborted';       // ⬅️ ensure status is set even if user canceled earlier
        toast.add({
            severity: 'warn',
            summary: 'Upload Canceled',
            detail: 'The import was canceled. No file was saved.',
            life: 4000
        });
        return; // early out; worker already cleaned the partial file
    }

    // Worker finished OK – continue
    upload_progress.value = 85;

    const opfsRoot = await navigator.storage.getDirectory();
    const directoryHandle = await opfsRoot.getDirectoryHandle('SlideRule');
    const fileHandle = await directoryHandle.getFileHandle(newFilename);
    const opfsFile = await fileHandle.getFile();

    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(newFilename, 'SlideRule');

    upload_progress.value = 90;

    const metadata = await duckDbClient.getAllParquetMetadata(opfsFile.name);
    console.log('SrImportParquetFile Extracted metadata:', metadata);
    // Metadata validations that DELETE the file on failure:
    if (!metadata || !('sliderule' in metadata)) {
      toast.add({ severity: 'error', summary: 'Invalid File Format', detail: 'SlideRule metadata missing.', life: 5000 });
      await directoryHandle.removeEntry(opfsFile.name);
      return;
    }
    if (!('meta' in metadata)) {
      toast.add({ severity: 'warn', summary: 'Incomplete File Format', detail: 'No "meta" field; cannot import.', life: 5000 });
      await directoryHandle.removeEntry(opfsFile.name);
      return;
    }

    upload_progress.value = 90;

    const srReqRec = await requestsStore.createNewSrRequestRecord();
    if (!srReqRec || !srReqRec.req_id) {
      await tryRemoveOpfsFile(newFilename); // cleanup
      toast.add({ severity: 'error', summary: 'Record Error', detail: 'Failed to create request record.', life: 4000 });
      return;
    }

    try {
      const metaRaw = metadata.meta;
      const metaObj = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;
      srReqRec.func = metaObj?.endpoint || getApiFromFilename(opfsFile.name).func;
      if (!srReqRec.func) throw new Error('Function not found in metadata or filename');

      const hasFit = metaObj?.request?.fit;
      const hasPhoReal = metaObj?.request?.phoreal;
      if (hasFit) srReqRec.func += '-surface';
      if (hasPhoReal) srReqRec.func += '-phoreal';
    } catch (e) {
      await tryRemoveOpfsFile(newFilename); // cleanup
      toast.add({ severity: 'error', summary: 'Metadata Error', detail: 'Unable to parse SlideRule metadata.', life: 4000 });
      console.error('Error parsing SlideRule metadata:', e);
      return;
    }

    srReqRec.file = opfsFile.name;
    srReqRec.status = 'imported';
    srReqRec.description = `Imported from SlideRule Parquet File ${file.name}`;
    srReqRec.num_bytes = opfsFile.size;

    upload_progress.value = 95;

    // If any of the following throws, we'll delete the OPFS file to avoid orphans
    try {
      const svr_parms_str = await duckDbLoadOpfsParquetFile(newFilename);
      srReqRec.svr_parms = svr_parms_str;
      const geoMetadata = await getGeoMetadataFromFile(newFilename);
      srReqRec.geo_metadata = geoMetadata;

      await indexedDb.updateRequestRecord(srReqRec, true);
      await recTreeStore.updateRecMenu('From customUploader', srReqRec.req_id);
      await readOrCacheSummary(srReqRec.req_id);
      await updateAreaInRecord(srReqRec.req_id);
      await updateNumGranulesInRecord(srReqRec.req_id);

      const summary = await indexedDb.getWorkerSummary(srReqRec.req_id);
      if (summary) {
        srReqRec.cnt = summary.numPoints;
        await indexedDb.updateRequestRecord(srReqRec, true);
        toast.add({ severity: 'success', summary: 'Import Complete', detail: 'File imported successfully!', life: 5000 });
        upload_status.value = 'success';
        emit('file-imported', srReqRec.req_id.toString());
      } else {
        throw new Error(`Failed to get summary for req_id: ${srReqRec.req_id}`);
      }
    } catch (laterErr) {
      // Critical: remove the OPFS file if post-copy processing failed
      await tryRemoveOpfsFile(newFilename);
      throw laterErr;
    }
  } catch (error) {
    upload_status.value = 'error';
    console.error('File import failed:', error);
    toast.add({ severity: 'error', summary: 'Import Failed', detail: (error as any)?.message || 'Problem importing the file.' });
  } finally {
    try { activeWorker.value?.terminate(); } catch {}
    activeWorker.value = null;
    isBusy.value = false;
    setTimeout(() => {
        upload_status.value = 'idle';
        upload_progress.value = 0;
        toast.removeGroup('headless');
    }, 2000);
  }

  upload_progress.value = 100;
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
                <section class="toast-container" :class="{'is-aborted': message.data.statusRef === 'aborted'}">
                <i class="upload-icon"></i>
                <div class="message-container">
                    <p class="summary">{{ message.summary }}</p>
                    <p class="detail">
                    <template v-if="message.data.statusRef === 'aborted'">
                        Upload canceled. No file saved.
                    </template>
                    <template v-else>
                        {{ message.detail }}
                    </template>
                    </p>

                    <div class="progress-container">
                    <ProgressBar
                        :value="message.data.progressRef"
                        :showValue="false"
                        class="progress-bar"
                        :class="{'progress-bar-aborted': message.data.statusRef === 'aborted'}"
                    />
                    <label class="upload-percentage">
                        <template v-if="message.data.statusRef === 'aborted'">
                        <span class="x-mark" aria-label="canceled">✕</span> canceled
                        </template>
                        <template v-else>
                        {{ message.data.progressRef }}% uploaded...
                        </template>
                    </label>
                    </div>

                    <div class="button-container" style="display:flex; gap:.5rem; justify-content:flex-end;">
                    <Button label="Cancel" text class="cancel-btn"
                            :disabled="message.data.statusRef !== 'uploading'"
                            @click="cancelUpload" />
                    <Button label="Done" text class="done-btn" @click="closeCallback" />
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

.button-container {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}
</style>
