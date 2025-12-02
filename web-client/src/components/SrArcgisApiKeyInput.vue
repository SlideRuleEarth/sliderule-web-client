<script setup lang="ts">
import { ref, computed } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useArcgisApiKeyStore } from '@/stores/arcgisApiKeyStore'
import { useToast } from 'primevue/usetoast'

const arcgisApiKeyStore = useArcgisApiKeyStore()
const toast = useToast()

const inputKey = ref('')
const showKey = ref(false)
const isValidating = ref(false)

const currentHost = computed(() => window.location.origin)
const hasStoredKey = computed(() => arcgisApiKeyStore.apiKey !== null)
const validationStatus = computed(() => arcgisApiKeyStore.validationStatus)

const maskedKey = computed(() => {
  if (!arcgisApiKeyStore.apiKey) return ''
  const key = arcgisApiKeyStore.apiKey
  if (key.length <= 8) return '********'
  return key.substring(0, 4) + '********' + key.substring(key.length - 4)
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
      return "This API key is restricted to a different website. Please add this site to your key's allowed referrers in the ArcGIS Developer Dashboard."
    case 'api_disabled':
      return 'The basemap tiles service is not enabled for this key. Please check your API key privileges.'
    case 'forbidden':
      return 'Access denied. Please check your API key permissions in the ArcGIS Developer Dashboard.'
    case 'invalid_key':
      return 'The API key format is invalid or expired. Please check that you copied the entire key.'
    default:
      return 'The API key is invalid or does not have basemap tile access.'
  }
}

async function validateAndSave() {
  if (!inputKey.value.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Missing Key',
      detail: 'Please enter an ArcGIS API key',
      life: 3000
    })
    return
  }

  isValidating.value = true
  const isValid = await arcgisApiKeyStore.validateApiKey(inputKey.value.trim())
  isValidating.value = false

  if (isValid) {
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'ArcGIS API key validated and saved',
      life: 3000
    })
    inputKey.value = ''
  } else {
    const errorType = arcgisApiKeyStore.getLastError()
    toast.add({
      severity: 'error',
      summary: 'Validation Failed',
      detail: getErrorMessage(errorType),
      life: 7000
    })
  }
}

function clearKey() {
  arcgisApiKeyStore.clearApiKey()
  inputKey.value = ''
  toast.add({
    severity: 'info',
    summary: 'Key Cleared',
    detail: 'ArcGIS API key has been removed',
    life: 3000
  })
}
</script>

<template>
  <div class="sr-arcgis-api-key-input">
    <div class="sr-api-key-description">
      <p>
        Enter your ArcGIS Developer API key to enable premium ArcGIS basemap layers (World Imagery,
        etc.).
      </p>

      <div class="sr-api-key-setup">
        <strong>How to get an ArcGIS API key:</strong>
        <ol>
          <li>
            <a href="https://location.arcgis.com" target="_blank" rel="noopener"
              >Sign in or create an ArcGIS Location Platform account</a
            >
            (free tier includes 2M basemap tiles/month)
          </li>
          <li>
            Go to
            <a href="https://location.arcgis.com/credentials/" target="_blank" rel="noopener"
              >Developer credentials</a
            >
            in your dashboard
          </li>
          <li>Click "New credential" &rarr; "API key credential"</li>
          <li>
            <strong>Configure privileges:</strong>
            <ul>
              <li>Enable <strong>"Basemaps"</strong> under Location services</li>
            </ul>
          </li>
          <li>
            <strong>Optional - Restrict your key:</strong>
            <ul>
              <li>
                Add referrer restriction: <code>{{ currentHost }}/*</code>
              </li>
            </ul>
          </li>
          <li>Generate the token and copy it below</li>
        </ol>
        <p class="sr-api-key-billing-note">
          <strong>Note:</strong> ArcGIS Location Platform includes a
          <a href="https://location.arcgis.com/pricing/" target="_blank" rel="noopener"
            >free tier with 2 million basemap tiles per month</a
          >.
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
          placeholder="Enter ArcGIS API key"
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
.sr-arcgis-api-key-input {
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
