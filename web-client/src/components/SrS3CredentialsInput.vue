<script setup lang="ts">
import { ref, computed } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useS3CredentialsStore } from '@/stores/s3CredentialsStore'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

const s3CredentialsStore = useS3CredentialsStore()
const githubAuthStore = useGitHubAuthStore()
const toast = useToast()

const accessKeyId = ref('')
const secretAccessKey = ref('')
const sessionToken = ref('')
const showSecrets = ref(false)

const isLoggedIn = computed(() => githubAuthStore.authToken !== null)
const canSave = computed(
  () => accessKeyId.value.trim() !== '' && secretAccessKey.value.trim() !== ''
)

const statusSeverity = computed(() =>
  isLoggedIn.value || s3CredentialsStore.hasCredentials ? 'success' : 'secondary'
)
const statusMessage = computed(() => {
  if (isLoggedIn.value) {
    return s3CredentialsStore.hasCredentials
      ? 'Logged in: S3 credentials are fetched automatically (pasted credentials are used only if that fails)'
      : 'Logged in: S3 credentials are fetched automatically'
  }
  if (s3CredentialsStore.hasCredentials) {
    return `Using pasted credentials (${s3CredentialsStore.accessKeyId.slice(0, 4)}••••••••)`
  }
  return 'No S3 credentials'
})

function save() {
  s3CredentialsStore.setCredentials(accessKeyId.value, secretAccessKey.value, sessionToken.value)
  accessKeyId.value = ''
  secretAccessKey.value = ''
  sessionToken.value = ''
  toast.add({
    severity: 'success',
    summary: 'S3 Credentials Saved',
    detail: 'Kept for this browser tab only',
    life: 3000
  })
}

function clear() {
  s3CredentialsStore.clearCredentials()
  toast.add({
    severity: 'info',
    summary: 'S3 Credentials Cleared',
    detail: 'Pasted S3 credentials have been removed',
    life: 3000
  })
}
</script>

<template>
  <div class="sr-s3-credentials-input">
    <p class="sr-s3-description">
      Read access to the <code>sliderule-public</code> bucket (used by the S2 Cells h_li_mean
      overlay) is obtained automatically when you log in. If you can't log in, paste the
      <code>access_key_id</code>, <code>secret_access_key</code>, and
      <code>session_token</code> returned by the provisioner's <code>/s3access</code> endpoint. They
      are kept for this browser tab only and stop working when they expire (one hour).
    </p>

    <Message :severity="statusSeverity" :closable="false">{{ statusMessage }}</Message>

    <form class="sr-s3-form" @submit.prevent="save">
      <InputText
        v-model="accessKeyId"
        :type="showSecrets ? 'text' : 'password'"
        placeholder="Access key ID"
        autocomplete="off"
      />
      <InputText
        v-model="secretAccessKey"
        :type="showSecrets ? 'text' : 'password'"
        placeholder="Secret access key"
        autocomplete="off"
      />
      <InputText
        v-model="sessionToken"
        :type="showSecrets ? 'text' : 'password'"
        placeholder="Session token"
        autocomplete="off"
      />
      <div class="sr-s3-buttons">
        <Button
          :icon="showSecrets ? 'pi pi-eye-slash' : 'pi pi-eye'"
          class="p-button-text"
          type="button"
          v-tooltip="showSecrets ? 'Hide' : 'Show'"
          @click="showSecrets = !showSecrets"
        />
        <Button label="Save" icon="pi pi-check" type="submit" :disabled="!canSave" />
        <Button
          v-if="s3CredentialsStore.hasCredentials"
          label="Clear"
          icon="pi pi-trash"
          severity="danger"
          type="button"
          @click="clear"
        />
      </div>
    </form>
  </div>
</template>

<style scoped>
.sr-s3-credentials-input {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem;
}

.sr-s3-description {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.sr-s3-description code {
  background-color: var(--surface-200);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.85em;
}

.sr-s3-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sr-s3-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
