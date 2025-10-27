<script setup lang="ts">
import { ref } from 'vue'
import ProgressBar from 'primevue/progressbar'
import Button from 'primevue/button'
import SrToast from 'primevue/toast'
// import { useToast } from 'primevue/usetoast'
// import { createLogger } from '@/utils/logger'

// const logger = createLogger('SrParquetFileUpload')

////////////// upload toast items
const upload_progress_visible = ref(false)
const upload_progress = ref(0)
//////////////
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
              <ProgressBar
                :value="upload_progress"
                :showValue="false"
                class="progress-bar"
              ></ProgressBar>
              <label class="upload-percentage">{{ upload_progress }}% uploaded...</label>
            </div>
            <div class="button-container">
              <Button
                label="Done"
                size="small"
                text
                class="done-btn"
                @click="closeCallback"
              ></Button>
            </div>
          </div>
        </section>
      </template>
    </SrToast>
  </div>
</template>

<style scoped>
.file-upload-panel {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0.5rem;
}
:deep(.p-progressbar-label) {
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

.summary,
.detail {
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
  color: var(--p-text-color);
}
</style>
