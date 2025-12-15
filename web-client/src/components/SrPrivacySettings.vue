<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import { usePrivacyConsentStore } from '@/stores/privacyConsentStore'
import { useSrToastStore } from '@/stores/srToastStore'
import { cleanupDelAllRequests } from '@/utils/storageUtils'

const router = useRouter()
const confirm = useConfirm()
const toast = useToast()
const privacyConsentStore = usePrivacyConsentStore()
const srToastStore = useSrToastStore()

const consentStatus = computed(() => privacyConsentStore.consentStatus)
const consentDate = computed(() => {
  if (!privacyConsentStore.consentTimestamp) return null
  return new Date(privacyConsentStore.consentTimestamp).toLocaleDateString()
})

function goToPrivacyPolicy() {
  void router.push('/privacy')
}

function confirmClearData() {
  confirm.require({
    message:
      'This will clear your authentication, preferences, and consent settings. You will need to log in again. Your science data (records and parquet files) will be preserved. Are you sure?',
    header: 'Clear All Data',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Clear All Data',
    rejectClass: 'p-button-secondary',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await privacyConsentStore.clearAllUserData()
      toast.add({
        severity: 'success',
        summary: 'Data Cleared',
        detail: 'Authentication and preferences cleared. Science data preserved.',
        life: srToastStore.getLife()
      })
      // Redirect to home page after clearing
      void router.push('/')
    }
  })
}

function confirmClearScienceData() {
  confirm.require({
    message:
      'This will delete all your request records and cached parquet data files. Your authentication and preferences will be preserved. Are you sure?',
    header: 'Clear Science Data',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Clear Science Data',
    rejectClass: 'p-button-secondary',
    acceptClass: 'p-button-warning',
    accept: async () => {
      await cleanupDelAllRequests()
      toast.add({
        severity: 'success',
        summary: 'Science Data Cleared',
        detail: 'All request records and parquet files have been removed.',
        life: srToastStore.getLife()
      })
    }
  })
}
</script>

<template>
  <div class="sr-privacy-settings">
    <ConfirmDialog />

    <!-- Current Status -->
    <div class="sr-privacy-status">
      <div class="sr-privacy-status-row">
        <span class="sr-privacy-label">Privacy notice:</span>
        <span class="sr-privacy-value">{{ consentStatus }}</span>
      </div>
      <div v-if="consentDate" class="sr-privacy-status-row">
        <span class="sr-privacy-label">Acknowledged:</span>
        <span class="sr-privacy-value">{{ consentDate }}</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="sr-privacy-actions">
      <Button
        label="Clear All My Data"
        icon="pi pi-trash"
        severity="danger"
        outlined
        title="Clears authentication, preferences, and consent settings. Preserves your science data (records and parquet files)."
        @click="confirmClearData"
      />
      <Button
        label="Clear Science Data"
        icon="pi pi-database"
        severity="warning"
        outlined
        title="Clears all request records and cached parquet files. Preserves your authentication and preferences."
        @click="confirmClearScienceData"
      />
    </div>

    <!-- Privacy Policy Link -->
    <div class="sr-privacy-link-section">
      <Button
        label="View Privacy Policy"
        icon="pi pi-external-link"
        link
        @click="goToPrivacyPolicy"
      />
    </div>
  </div>
</template>

<style scoped>
.sr-privacy-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sr-privacy-status {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--p-surface-800, #1e1e1e);
  border: 1px solid var(--p-surface-600, #3e3e3e);
  border-radius: 8px;
}

.sr-privacy-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sr-privacy-label {
  color: var(--p-text-muted-color, #888);
}

.sr-privacy-value {
  font-weight: 500;
}

.sr-privacy-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.sr-privacy-link-section {
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--p-surface-600, #3e3e3e);
  padding-top: 1rem;
}
</style>
