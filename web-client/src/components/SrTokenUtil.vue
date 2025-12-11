<script setup lang="ts">
import { ref, computed } from 'vue'
import Fieldset from 'primevue/fieldset'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
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

// Input for pasting JWT
const pastedToken = ref('')

// Decoded claims from pasted JWT
const decodedClaims = ref<Record<string, unknown> | null>(null)
const decodeError = ref<string | null>(null)

// Copy status
const copySuccess = ref(false)

/**
 * Decode a JWT token's payload (middle segment)
 * JWTs are base64url encoded, so we need to handle that
 */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.trim().split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format: expected 3 parts separated by dots')
    }

    // Decode the payload (second part)
    const payload = parts[1]

    // Base64url to base64 conversion
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/')

    // Add padding if necessary
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
 * Handle pasting and decoding a JWT
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
  // Common JWT timestamp claims
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
  <Fieldset v-if="canAccess" legend="Token Utility" toggleable :collapsed="true">
    <div class="sr-token-util">
      <!-- Current User's Token Section -->
      <div class="sr-section">
        <h4 class="sr-section-title">Your Current Token</h4>
        <div v-if="currentToken" class="sr-current-token">
          <div class="sr-token-display">
            <code class="sr-token-text">{{ currentToken.substring(0, 50) }}...</code>
          </div>
          <Button
            :label="copySuccess ? 'Copied!' : 'Copy Token'"
            :icon="copySuccess ? 'pi pi-check' : 'pi pi-copy'"
            :severity="copySuccess ? 'success' : 'secondary'"
            size="small"
            @click="copyCurrentToken"
          />
          <!-- Decoded Current Token Claims -->
          <div v-if="currentTokenClaims" class="sr-claims-display">
            <h5 class="sr-claims-title">Token Claims:</h5>
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
      </div>

      <!-- JWT Decoder Section -->
      <div class="sr-section">
        <h4 class="sr-section-title">JWT Decoder</h4>
        <p class="sr-section-desc">Paste any JWT to view its claims:</p>
        <Textarea
          v-model="pastedToken"
          placeholder="Paste JWT token here..."
          rows="2"
          class="sr-token-input"
        />
        <div class="sr-button-row">
          <Button label="Decode" icon="pi pi-search" size="small" @click="handleDecode" />
          <Button
            label="Clear"
            icon="pi pi-times"
            severity="secondary"
            size="small"
            @click="handleClear"
          />
        </div>

        <!-- Error Display -->
        <div v-if="decodeError" class="sr-decode-error">
          {{ decodeError }}
        </div>

        <!-- Decoded Claims Display -->
        <div v-if="decodedClaims" class="sr-claims-display">
          <h5 class="sr-claims-title">Decoded Claims:</h5>
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
      </div>
    </div>
  </Fieldset>
</template>

<style scoped>
.sr-token-util {
  padding: 0.5rem 0;
}

.sr-section {
  margin-bottom: 1.5rem;
}

.sr-section:last-child {
  margin-bottom: 0;
}

.sr-section-title {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color);
}

.sr-section-desc {
  margin: 0 0 0.5rem 0;
  font-size: 0.8125rem;
  color: var(--text-color-secondary);
}

.sr-current-token {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sr-token-display {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: var(--p-border-radius);
  padding: 0.5rem;
  overflow: hidden;
}

.sr-token-text {
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

.sr-token-input {
  width: 100%;
  font-family: monospace;
  font-size: 0.75rem;
  max-height: 4rem;
  overflow-y: auto;
  resize: none;
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

.sr-claims-display {
  margin-top: 1rem;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: var(--p-border-radius);
  padding: 0.75rem;
}

.sr-claims-title {
  margin: 0 0 0.5rem 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-color);
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
  padding: 0.375rem 0.5rem;
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
</style>
