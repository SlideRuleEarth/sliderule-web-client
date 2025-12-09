<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

const props = defineProps<{
  expandTokenDetails?: boolean
}>()

const githubAuthStore = useGitHubAuthStore()

const authStatus = computed(() => githubAuthStore.authStatus)
const username = computed(() => githubAuthStore.username)
const isMember = computed(() => githubAuthStore.isMember)
const isOwner = computed(() => githubAuthStore.isOwner)
const lastError = computed(() => githubAuthStore.lastError)
const hasValidAuth = computed(() => githubAuthStore.hasValidAuth)
const isAuthenticated = computed(() => authStatus.value === 'authenticated' && hasValidAuth.value)
const isAuthenticating = computed(() => authStatus.value === 'authenticating')

// JWT details
const showTokenDetails = ref(props.expandTokenDetails ?? false)

// Watch for prop changes to expand token details
watch(
  () => props.expandTokenDetails,
  (newVal) => {
    if (newVal) {
      showTokenDetails.value = true
    }
  }
)

const decodedToken = computed(() => githubAuthStore.decodedToken)
const tokenExpiresAt = computed(() => githubAuthStore.tokenExpiresAt)
const teams = computed(() => githubAuthStore.teams)

const statusSeverity = computed(() => {
  if (authStatus.value === 'error') return 'error'
  if (!isAuthenticated.value) return 'secondary'
  if (isOwner.value) return 'success'
  if (isMember.value) return 'success'
  return 'warn'
})

const statusMessage = computed(() => {
  if (authStatus.value === 'error') {
    return lastError.value || 'Authentication failed'
  }
  if (authStatus.value === 'authenticating') {
    return 'Authenticating with GitHub...'
  }
  if (!isAuthenticated.value) {
    return 'Not signed in to GitHub'
  }
  if (isOwner.value) {
    return `Signed in as ${username.value} - Organization Owner`
  }
  if (isMember.value) {
    return `Signed in as ${username.value} - Organization Member`
  }
  return `Signed in as ${username.value} - Not a member of SlideRuleEarth`
})

const membershipDescription = computed(() => {
  if (!isAuthenticated.value) return ''
  if (isOwner.value || isMember.value) {
    return 'You have access to organization member features.'
  }
  return 'Some features are only available to SlideRuleEarth organization members.'
})

function handleLogin() {
  githubAuthStore.initiateLogin()
}

function handleLogout() {
  githubAuthStore.logout()
}
</script>

<template>
  <div class="sr-github-org-auth">
    <div class="sr-auth-description">
      <p>
        Sign in with GitHub to verify your membership in the SlideRuleEarth organization.
        Organization members have access to additional features.
      </p>
    </div>

    <Message :severity="statusSeverity" :closable="false" class="sr-status-message">
      {{ statusMessage }}
    </Message>

    <p v-if="membershipDescription" class="sr-membership-description">
      {{ membershipDescription }}
    </p>

    <div class="sr-button-row">
      <Button
        v-if="!isAuthenticated"
        label="Sign in with GitHub"
        icon="pi pi-github"
        @click="handleLogin"
        :loading="isAuthenticating"
        :disabled="isAuthenticating"
        class="sr-login-button"
      />
      <Button
        v-if="isAuthenticated"
        label="Sign Out"
        icon="pi pi-sign-out"
        @click="handleLogout"
        severity="secondary"
        class="sr-logout-button"
      />
    </div>

    <!-- JWT Token Details (expandable) -->
    <div v-if="isAuthenticated && decodedToken" class="sr-token-details">
      <button class="sr-token-toggle" @click="showTokenDetails = !showTokenDetails" type="button">
        <i :class="showTokenDetails ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
        <span>Token Details</span>
      </button>

      <div v-if="showTokenDetails" class="sr-token-content">
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
              <td class="sr-token-label">Member:</td>
              <td class="sr-token-value">{{ decodedToken.is_member ? 'Yes' : 'No' }}</td>
            </tr>
            <tr>
              <td class="sr-token-label">Owner:</td>
              <td class="sr-token-value">{{ decodedToken.is_owner ? 'Yes' : 'No' }}</td>
            </tr>
            <tr>
              <td class="sr-token-label">Teams:</td>
              <td class="sr-token-value">
                <span v-if="teams.length === 0" class="sr-no-teams">None</span>
                <span v-else>{{ teams.join(', ') }}</span>
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
    </div>
  </div>
</template>

<style scoped>
.sr-github-org-auth {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem;
}

.sr-auth-description {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.sr-auth-description > p {
  margin: 0;
}

.sr-status-message {
  margin: 0;
}

.sr-membership-description {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin: 0;
  padding: 0.5rem;
  background-color: var(--surface-100);
  border-radius: var(--border-radius);
}

.sr-button-row {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-start;
}

.sr-login-button {
  flex-shrink: 0;
}

.sr-logout-button {
  flex-shrink: 0;
}

/* Token Details */
.sr-token-details {
  margin-top: 0.5rem;
  border: 1px solid var(--surface-300);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.sr-token-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background-color: var(--surface-100);
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-color);
  text-align: left;
}

.sr-token-toggle:hover {
  background-color: var(--surface-200);
}

.sr-token-toggle i {
  font-size: 0.75rem;
}

.sr-token-content {
  padding: 0.75rem;
  background-color: var(--surface-50);
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

.sr-no-teams {
  color: var(--text-color-secondary);
  font-style: italic;
}
</style>
