<script setup lang="ts">
import { onMounted, ref } from 'vue';
import FileUpload from 'primevue/fileupload';
import ProgressBar from 'primevue/progressbar';
import Button from 'primevue/button';
import SrToast from 'primevue/toast';
import { useGeoJsonUploader } from '@/composables/useGeoJsonUploader';
import { createLogger } from '@/utils/logger';

const logger = createLogger('SrGeoJsonFileUpload');

const emit = defineEmits<{
    (e: 'done'): void;   // use lowercase; parent listens as @done
}>();

const props = defineProps({
    reportUploadProgress: {
        type: Boolean,
        default: false
    },
    label: {
        type: String,
        default: 'Upload GeoJSON File'
    },
    loadReqPoly: {
        type: Boolean,
        default: false
    }
});

const upload_progress = ref(0);
const upload_progress_visible = ref(false);

const { handleUpload } = useGeoJsonUploader(
    props,
    upload_progress,
    upload_progress_visible,
    () => emit('done')   // pass a callback the composable can call
);

onMounted(() => {
    if(props.loadReqPoly){
        logger.debug('onMounted: will load request polygon');
    } else {
        logger.debug('onMounted: will load features');
    }
});

const onSelect = (_e: any) => {
    logger.debug('onSelect');
};

const onError = (e: any) => {
    logger.error('onError', { e });
};

const onClear = () => {
    logger.debug('onClear');
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
                        <div class="progress-container" v-if="reportUploadProgress">
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
        <div class="sr-file-upload">
            <FileUpload 
                    mode="basic" 
                    name="SrFileUploads[]" 
                    :auto="true" 
                    accept=".geojson,.json" 
                    :maxFileSize="10000000000" 
                    customUpload 
                    :chooseLabel="label"
                    :chooseIcon="'pi pi-upload'"
                    @uploader="handleUpload"
                    @select="onSelect"
                    @error="onError"
                    @clear="onClear"
            />   
        </div>
    </div>
</template>

<style scoped>

.sr-file-upload {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
}

.file-upload-panel { 
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
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

</style>
