<script setup lang="ts">
import { computed } from 'vue'
import Fieldset from 'primevue/fieldset'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

const githubAuthStore = useGitHubAuthStore()

// User info from store state (not decoded from JWT - provided separately by server)
const username = computed(() => githubAuthStore.username)
const org = computed(() => githubAuthStore.org)
const isOrgMember = computed(() => githubAuthStore.isOrgMember)
const isOrgOwner = computed(() => githubAuthStore.isOrgOwner)
const teams = computed(() => githubAuthStore.teams)
const teamRoles = computed(() => githubAuthStore.teamRoles)
const orgRoles = computed(() => githubAuthStore.orgRoles)
const accessibleClusters = computed(() => githubAuthStore.accessibleClusters)
const deployableClusters = computed(() => githubAuthStore.deployableClusters)

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
            <td class="sr-token-label">Username:</td>
            <td class="sr-token-value">{{ username ?? 'N/A' }}</td>
          </tr>
          <tr>
            <td class="sr-token-label">Organization:</td>
            <td class="sr-token-value">{{ org ?? 'N/A' }}</td>
          </tr>
          <tr>
            <td class="sr-token-label">Org Member:</td>
            <td class="sr-token-value">{{ isOrgMember ? 'Yes' : 'No' }}</td>
          </tr>
          <tr>
            <td class="sr-token-label">Org Owner:</td>
            <td class="sr-token-value">{{ isOrgOwner ? 'Yes' : 'No' }}</td>
          </tr>
          <tr>
            <td class="sr-token-label">Teams:</td>
            <td class="sr-token-value">
              <span v-if="teams.length === 0" class="sr-no-value">None</span>
              <span v-else>{{ teams.join(', ') }}</span>
            </td>
          </tr>
          <tr>
            <td class="sr-token-label">Org Roles:</td>
            <td class="sr-token-value">
              <span v-if="orgRoles.length === 0" class="sr-no-value">None</span>
              <span v-else>{{ orgRoles.join(', ') }}</span>
            </td>
          </tr>
          <tr>
            <td class="sr-token-label">Team Roles:</td>
            <td class="sr-token-value">
              <span v-if="Object.keys(teamRoles).length === 0" class="sr-no-value">None</span>
              <div v-else class="sr-team-roles">
                <div v-for="(role, team) in teamRoles" :key="team" class="sr-team-role">
                  {{ team }}: {{ role }}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td class="sr-token-label">Accessible Clusters:</td>
            <td class="sr-token-value">
              <span v-if="accessibleClusters.length === 0" class="sr-no-value">None</span>
              <span v-else>{{ accessibleClusters.join(', ') }}</span>
            </td>
          </tr>
          <tr>
            <td class="sr-token-label">Deployable Clusters:</td>
            <td class="sr-token-value">
              <span v-if="deployableClusters.length === 0" class="sr-no-value">None</span>
              <span v-else>{{ deployableClusters.join(', ') }}</span>
            </td>
          </tr>
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

.sr-no-value {
  color: var(--text-color-secondary);
  font-style: italic;
}

.sr-team-roles {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sr-team-role {
  font-size: 0.75rem;
}
</style>
