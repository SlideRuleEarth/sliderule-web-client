<script setup lang="ts">
import { computed } from 'vue'
import Fieldset from 'primevue/fieldset'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

const githubAuthStore = useGitHubAuthStore()

// Token metadata from store state (provided separately by server for UX)
const maxNodes = computed(() => githubAuthStore.maxNodes)
const clusterTtlHours = computed(() => githubAuthStore.clusterTtlHours)
const tokenIssuedAt = computed(() => githubAuthStore.tokenIssuedAtDate)
const tokenExpiresAt = computed(() => githubAuthStore.tokenExpiresAt)
const tokenIssuer = computed(() => githubAuthStore.tokenIssuer)

// Show token details when user is authenticated
const isAuthenticated = computed(() => githubAuthStore.authStatus === 'authenticated')
</script>

<template>
  <Fieldset v-if="isAuthenticated" legend="Token Details" toggleable>
    <div class="sr-token-details">
      <table class="sr-token-table">
        <tbody>
          <tr>
            <td class="sr-token-label">Max Nodes:</td>
            <td class="sr-token-value">{{ maxNodes ?? 'N/A' }}</td>
          </tr>
          <tr>
            <td class="sr-token-label">Cluster TTL:</td>
            <td class="sr-token-value">
              {{ clusterTtlHours != null ? `${clusterTtlHours} hours` : 'N/A' }}
            </td>
          </tr>
          <tr>
            <td class="sr-token-label">Issued:</td>
            <td class="sr-token-value">
              {{ tokenIssuedAt ? tokenIssuedAt.toLocaleString() : 'N/A' }}
            </td>
          </tr>
          <tr>
            <td class="sr-token-label">Expires:</td>
            <td class="sr-token-value">
              {{ tokenExpiresAt ? tokenExpiresAt.toLocaleString() : 'N/A' }}
            </td>
          </tr>
          <tr>
            <td class="sr-token-label">Issuer:</td>
            <td class="sr-token-value">{{ tokenIssuer ?? 'N/A' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </Fieldset>
</template>

<style scoped>
.sr-token-details {
  padding: 0.5rem 0;
}

.sr-token-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.sr-token-table td {
  padding: 0.25rem 0.5rem;
  vertical-align: top;
}

.sr-token-label {
  font-weight: 500;
  color: var(--text-color-secondary);
  white-space: nowrap;
  width: 1%;
}

.sr-token-value {
  color: var(--text-color);
  word-break: break-word;
}
</style>
