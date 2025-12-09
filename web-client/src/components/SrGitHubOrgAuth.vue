<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

const githubAuthStore = useGitHubAuthStore()

const authStatus = computed(() => githubAuthStore.authStatus)
const username = computed(() => githubAuthStore.username)
const isMember = computed(() => githubAuthStore.isMember)
const isOwner = computed(() => githubAuthStore.isOwner)
const lastError = computed(() => githubAuthStore.lastError)
const hasValidAuth = computed(() => githubAuthStore.hasValidAuth)
const isAuthenticated = computed(() => authStatus.value === 'authenticated' && hasValidAuth.value)
const isAuthenticating = computed(() => authStatus.value === 'authenticating')

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
    <Message :severity="statusSeverity" :closable="false" class="sr-status-message">
      {{ statusMessage }}
    </Message>

    <p v-if="membershipDescription" class="sr-membership-description">
      {{ membershipDescription }}
    </p>

    <div class="sr-button-row">
      <div
        v-if="!isAuthenticated"
        title="Sign in with GitHub to verify your membership in the SlideRuleEarth organization. Organization members have access to additional features."
      >
        <Button
          label="Sign in with GitHub"
          icon="pi pi-github"
          @click="handleLogin"
          :loading="isAuthenticating"
          :disabled="isAuthenticating"
          class="sr-login-button"
        />
      </div>
      <Button
        v-if="isAuthenticated"
        label="Sign Out"
        icon="pi pi-sign-out"
        @click="handleLogout"
        severity="secondary"
        class="sr-logout-button"
      />
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
</style>
