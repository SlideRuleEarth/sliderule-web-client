<script setup lang="ts">
import { ref, computed } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useGoogleApiKeyStore } from '@/stores/googleApiKeyStore'
import { useToast } from 'primevue/usetoast'

const googleApiKeyStore = useGoogleApiKeyStore()
const toast = useToast()

const inputKey = ref('')
const showKey = ref(false)
const isValidating = ref(false)

const currentHost = computed(() => window.location.origin)
const hasStoredKey = computed(() => googleApiKeyStore.apiKey !== null)
const validationStatus = computed(() => googleApiKeyStore.validationStatus)

const maskedKey = computed(() => {
  if (!googleApiKeyStore.apiKey) return ''
  const key = googleApiKeyStore.apiKey
  if (key.length <= 8) return '••••••••'
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4)
})

const statusSeverity = computed(() => {
  switch (validationStatus.value) {
    case 'valid':
      return 'success'
    case 'invalid':
      return 'error'
    case 'validating':
      return 'info'
    default:
      return 'secondary'
  }
})

const statusMessage = computed(() => {
  switch (validationStatus.value) {
    case 'valid':
      return 'API key is valid and active'
    case 'invalid':
      return 'API key validation failed'
    case 'validating':
      return 'Validating API key...'
    default:
      return 'No API key configured'
  }
})

function getErrorMessage(errorType: string | null): string {
  switch (errorType) {
    case 'referrer_restricted':
      return "This API key is restricted to a different website. Please add this site to your key's allowed referrers in Google Cloud Console."
    case 'api_disabled':
      return 'The Map Tiles API is not enabled for this key. Please enable it in Google Cloud Console.'
    case 'forbidden':
      return 'Access denied. Please check your API key permissions in Google Cloud Console.'
    case 'invalid_key':
      return 'The API key format is invalid. Please check that you copied the entire key.'
    default:
      return 'The API key is invalid or the Map Tiles API is not enabled.'
  }
}

async function validateAndSave() {
  if (!inputKey.value.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Missing Key',
      detail: 'Please enter a Google API key',
      life: 3000
    })
    return
  }

  isValidating.value = true
  const isValid = await googleApiKeyStore.validateApiKey(inputKey.value.trim())
  isValidating.value = false

  if (isValid) {
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Google API key validated and saved',
      life: 3000
    })
    inputKey.value = ''
  } else {
    const errorType = googleApiKeyStore.getLastError()
    toast.add({
      severity: 'error',
      summary: 'Validation Failed',
      detail: getErrorMessage(errorType),
      life: 7000
    })
  }
}

function clearKey() {
  googleApiKeyStore.clearApiKey()
  inputKey.value = ''
  toast.add({
    severity: 'info',
    summary: 'Key Cleared',
    detail: 'Google API key has been removed',
    life: 3000
  })
}
</script>

<template>
  <div class="sr-google-api-key-input">
    <div class="sr-api-key-description">
      <p>Enter your Google Maps Platform API key to enable the Google satellite base layer.</p>

      <div class="sr-api-key-setup">
        <strong>How to get a Google API key:</strong>
        <ol>
          <li>
            <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener"
              >Create a Google Cloud project</a
            >
            (or select an existing one)
          </li>
          <li>
            <a
              href="https://console.cloud.google.com/apis/library/tile.googleapis.com"
              target="_blank"
              rel="noopener"
              >Enable the Map Tiles API</a
            >
            for your project
          </li>
          <li>
            <a
              href="https://console.cloud.google.com/apis/credentials/key"
              target="_blank"
              rel="noopener"
              >Create a new API key</a
            >
          </li>
          <li>
            <strong>Important - Restrict your key:</strong>
            <ul>
              <li>Under "Application restrictions", select <strong>"Websites"</strong></li>
              <li>
                Click "Add" and enter: <code>{{ currentHost }}/*</code>
              </li>
              <li>
                Under "API restrictions", select <strong>"Restrict key"</strong> and choose
                <strong>"Map Tiles API"</strong>
              </li>
            </ul>
          </li>
          <li>Copy your API key and paste it below</li>
        </ol>
        <p class="sr-api-key-billing-note">
          <strong>Note:</strong> Google requires billing to be enabled, but offers a
          <a href="https://mapsplatform.google.com/pricing/" target="_blank" rel="noopener"
            >free $200/month credit</a
          >
          which covers typical personal use.
        </p>
      </div>
    </div>

    <Message :severity="statusSeverity" :closable="false" class="sr-status-message">
      {{ statusMessage }}
      <span v-if="hasStoredKey && validationStatus === 'valid'" class="sr-masked-key">
        ({{ maskedKey }})
      </span>
    </Message>

    <div class="sr-api-key-form">
      <div class="sr-input-row">
        <InputText
          v-model="inputKey"
          :type="showKey ? 'text' : 'password'"
          placeholder="Enter Google API key"
          class="sr-api-key-input-field"
          :disabled="isValidating"
        />
        <Button
          :icon="showKey ? 'pi pi-eye-slash' : 'pi pi-eye'"
          @click="showKey = !showKey"
          class="p-button-text"
          :disabled="isValidating"
          v-tooltip="showKey ? 'Hide key' : 'Show key'"
        />
      </div>
      <div class="sr-button-row">
        <Button
          label="Validate & Save"
          icon="pi pi-check"
          @click="validateAndSave"
          :loading="isValidating"
          :disabled="!inputKey.trim()"
          class="sr-save-button"
        />
        <Button
          v-if="hasStoredKey"
          label="Clear Key"
          icon="pi pi-trash"
          @click="clearKey"
          severity="danger"
          :disabled="isValidating"
          class="sr-clear-button"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sr-google-api-key-input {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem;
}

.sr-api-key-description {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.sr-api-key-description > p {
  margin: 0 0 0.5rem 0;
}

.sr-api-key-setup {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background-color: var(--surface-100);
  border-radius: var(--border-radius);
  border-left: 3px solid var(--primary-color);
}

.sr-api-key-setup ol {
  margin: 0.5rem 0 0 1.25rem;
  padding: 0;
}

.sr-api-key-setup li {
  margin: 0.5rem 0;
  line-height: 1.4;
}

.sr-api-key-setup ul {
  margin: 0.25rem 0 0 1rem;
  padding: 0;
  list-style-type: disc;
}

.sr-api-key-setup ul li {
  margin: 0.25rem 0;
}

.sr-api-key-setup a {
  color: var(--primary-color);
  text-decoration: underline;
  font-weight: 600;
}

.sr-api-key-setup a:hover {
  color: var(--primary-600);
  text-decoration: underline;
}

.sr-api-key-setup a::after {
  content: ' ↗';
  font-size: 0.75em;
}

.sr-api-key-setup code {
  background-color: var(--surface-200);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.85em;
  user-select: all;
}

.sr-api-key-billing-note {
  margin-top: 0.75rem;
  padding: 0.5rem;
  background-color: var(--surface-50);
  border-radius: var(--border-radius);
  font-size: 0.85rem;
}

.sr-status-message {
  margin: 0;
}

.sr-masked-key {
  font-family: monospace;
  margin-left: 0.5rem;
}

.sr-api-key-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sr-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.sr-api-key-input-field {
  flex: 1;
  font-family: monospace;
}

.sr-button-row {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-start;
}

.sr-save-button {
  flex-shrink: 0;
}

.sr-clear-button {
  flex-shrink: 0;
}
</style>
