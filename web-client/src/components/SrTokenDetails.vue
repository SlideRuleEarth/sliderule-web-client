<script setup lang="ts">
import { computed } from 'vue'
import Fieldset from 'primevue/fieldset'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

const githubAuthStore = useGitHubAuthStore()

const decodedToken = computed(() => githubAuthStore.decodedToken)
const tokenExpiresAt = computed(() => githubAuthStore.tokenExpiresAt)
const teams = computed(() => githubAuthStore.teams)
const teamRoles = computed(() => githubAuthStore.teamRoles)
const orgRoles = computed(() => githubAuthStore.orgRoles)
const allowedClusters = computed(() => githubAuthStore.allowedClusters)
</script>

<template>
  <Fieldset v-if="decodedToken" legend="Token Details" toggleable>
    <div class="sr-token-details">
      <table class="sr-token-table">
        <tbody>
          <tr>
            <td class="sr-token-label">Username:</td>
            <td class="sr-token-value">{{ decodedToken.username }}</td>
          </tr>
          <tr>
            <td class="sr-token-label">Organization:</td>
            <td class="sr-token-value">{{ decodedToken.org }}</td>
          </tr>
          <tr>
            <td class="sr-token-label">Org Member:</td>
            <td class="sr-token-value">{{ decodedToken.is_org_member ? 'Yes' : 'No' }}</td>
          </tr>
          <tr>
            <td class="sr-token-label">Org Owner:</td>
            <td class="sr-token-value">{{ decodedToken.is_org_owner ? 'Yes' : 'No' }}</td>
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
            <td class="sr-token-label">Allowed Clusters:</td>
            <td class="sr-token-value">
              <span v-if="allowedClusters.length === 0" class="sr-no-value">None</span>
              <span v-else>{{ allowedClusters.join(', ') }}</span>
            </td>
          </tr>
          <tr>
            <td class="sr-token-label">Max Nodes:</td>
            <td class="sr-token-value">{{ decodedToken.max_nodes ?? 'N/A' }}</td>
          </tr>
          <tr>
            <td class="sr-token-label">Cluster TTL:</td>
            <td class="sr-token-value">
              {{
                decodedToken.cluster_ttl_hours != null
                  ? `${decodedToken.cluster_ttl_hours} hours`
                  : 'N/A'
              }}
            </td>
          </tr>
          <tr>
            <td class="sr-token-label">Issued:</td>
            <td class="sr-token-value">
              {{
                decodedToken.iat
                  ? new Date(Number(decodedToken.iat) * 1000).toLocaleString()
                  : 'N/A'
              }}
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
            <td class="sr-token-value">{{ decodedToken.iss }}</td>
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
