<script setup lang="ts">
import { computed, ref } from 'vue'
import Fieldset from 'primevue/fieldset'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Badge from 'primevue/badge'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

const githubAuthStore = useGitHubAuthStore()

// Only show to authenticated org members
const canAccess = computed(() => githubAuthStore.canAccessMemberFeatures)

// Current user's token
const currentToken = computed(() => githubAuthStore.token)

// Decoded claims from current token
const currentTokenClaims = computed(() => {
  if (!currentToken.value) return null
  return decodeJwt(currentToken.value)
})

// Copy status
const copySuccess = ref(false)

// JWT Decoder state
const pastedToken = ref('')
const decodedClaims = ref<Record<string, unknown> | null>(null)
const decodeError = ref<string | null>(null)

/**
 * Decode a JWT token's payload (middle segment)
 */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.trim().split('.')
    if (parts.length !== 3) {
      return null
    }

    const payload = parts[1]
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padding = base64.length % 4
    if (padding) {
      base64 += '='.repeat(4 - padding)
    }

    const decoded = atob(base64)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Handle decoding a pasted JWT
 */
function handleDecode() {
  decodeError.value = null
  decodedClaims.value = null

  if (!pastedToken.value.trim()) {
    decodeError.value = 'Please paste a JWT token'
    return
  }

  const claims = decodeJwt(pastedToken.value)
  if (claims) {
    decodedClaims.value = claims
  } else {
    decodeError.value = 'Failed to decode JWT. Please check the token format.'
  }
}

/**
 * Clear the pasted token and decoded claims
 */
function handleClear() {
  pastedToken.value = ''
  decodedClaims.value = null
  decodeError.value = null
}

/**
 * Copy current token to clipboard
 */
async function copyCurrentToken() {
  if (!currentToken.value) return

  try {
    await navigator.clipboard.writeText(currentToken.value)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (e) {
    console.error('Failed to copy token:', e)
  }
}

/**
 * Format timestamp claims for display
 */
function formatClaimValue(key: string, value: unknown): string {
  const timestampClaims = ['iat', 'exp', 'nbf', 'auth_time']

  if (timestampClaims.includes(key) && typeof value === 'number') {
    const date = new Date(value * 1000)
    return `${value} (${date.toLocaleString()})`
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }

  return String(value)
}
</script>

<template>
  <Fieldset v-if="canAccess" legend="Your Current Token Claims" toggleable :collapsed="true">
    <div v-if="currentToken" class="sr-current-token">
      <div v-if="currentTokenClaims" class="sr-claims-display">
        <table class="sr-claims-table">
          <tbody>
            <tr v-for="(value, key) in currentTokenClaims" :key="key">
              <td class="sr-claim-key">{{ key }}</td>
              <td class="sr-claim-value">
                <pre>{{ formatClaimValue(String(key), value) }}</pre>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <p v-else class="sr-no-token">No token available</p>
  </Fieldset>

  <div class="sr-token-container" v-if="currentToken">
    <Badge value="your current token" severity="info" class="sr-token-badge" />
    <div class="sr-token-row">
      <code class="sr-token-text">{{ currentToken.substring(0, 50) }}...</code>
      <Button
        :label="copySuccess ? 'Copied!' : 'Copy'"
        :icon="copySuccess ? 'pi pi-check' : 'pi pi-copy'"
        :severity="copySuccess ? 'success' : undefined"
        size="small"
        variant="text"
        @click="copyCurrentToken"
      />
    </div>
  </div>

  <Fieldset
    v-if="canAccess"
    legend="JWT Decoder"
    toggleable
    :collapsed="true"
    class="sr-decoder-fieldset"
  >
    <p class="sr-decoder-desc">Paste any JWT to view its claims:</p>
    <Textarea
      v-model="pastedToken"
      placeholder="Paste JWT token here..."
      rows="2"
      class="sr-token-input"
    />
    <div class="sr-button-row">
      <Button
        label="Decode"
        icon="pi pi-search"
        size="small"
        variant="text"
        @click="handleDecode"
      />
      <Button label="Clear" icon="pi pi-times" size="small" variant="text" @click="handleClear" />
    </div>

    <div v-if="decodeError" class="sr-decode-error">
      {{ decodeError }}
    </div>

    <div v-if="decodedClaims" class="sr-claims-display">
      <table class="sr-claims-table">
        <tbody>
          <tr v-for="(value, key) in decodedClaims" :key="key">
            <td class="sr-claim-key">{{ key }}</td>
            <td class="sr-claim-value">
              <pre>{{ formatClaimValue(String(key), value) }}</pre>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Fieldset>
</template>

<style scoped>
.sr-current-token {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sr-token-container {
  position: relative;
  margin-top: 1rem;
}

.sr-token-badge {
  position: absolute;
  top: -0.6rem;
  left: 0.5rem;
  font-size: 0.65rem !important;
  text-transform: lowercase;
}

.sr-token-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: var(--p-border-radius);
  padding: 0.25rem 0.5rem;
}

.sr-token-text {
  flex: 1;
  font-size: 0.75rem;
  word-break: break-all;
  color: var(--text-color-secondary);
}

.sr-no-token {
  font-size: 0.8125rem;
  color: var(--text-color-secondary);
  font-style: italic;
  margin: 0;
}

.sr-claims-display {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: var(--p-border-radius);
  padding: 0.5rem;
}

.sr-claims-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

.sr-claims-table tr {
  border-bottom: 1px solid var(--surface-border);
}

.sr-claims-table tr:last-child {
  border-bottom: none;
}

.sr-claims-table td {
  padding: 0.25rem 0.5rem;
  vertical-align: top;
}

.sr-claim-key {
  font-weight: 500;
  color: var(--primary-color);
  white-space: nowrap;
  width: 1%;
}

.sr-claim-value {
  color: var(--text-color);
  word-break: break-word;
}

.sr-claim-value pre {
  margin: 0;
  font-family: monospace;
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.sr-decoder-fieldset {
  margin-top: 1rem;
}

.sr-decoder-desc {
  margin: 0 0 0.5rem 0;
  font-size: 0.8125rem;
  color: var(--text-color-secondary);
}

.sr-token-input {
  width: 100%;
  font-family: monospace;
  font-size: 0.75rem;
}

.sr-button-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.sr-decode-error {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--red-50);
  border: 1px solid var(--red-200);
  border-radius: var(--p-border-radius);
  color: var(--red-700);
  font-size: 0.8125rem;
}
</style>
