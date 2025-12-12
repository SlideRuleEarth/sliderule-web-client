<script setup lang="ts">
import { computed } from 'vue'
import SingleColumnLayout from '@/layouts/SingleColumnLayout.vue'
import Card from 'primevue/card'
import Message from 'primevue/message'
import SrSysConfig from '@/components/SrSysConfig.vue'
import SrUserInfo from '@/components/SrUserInfo.vue'
import SrTokenUtil from '@/components/SrTokenUtil.vue'
import SrDeployConfig from '@/components/SrDeployConfig.vue'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

const githubAuthStore = useGitHubAuthStore()

// Auth state computed properties
const isAuthenticated = computed(() => {
  return githubAuthStore.authStatus === 'authenticated' && githubAuthStore.hasValidAuth
})
const isAuthenticating = computed(() => githubAuthStore.authStatus === 'authenticating')
const username = computed(() => githubAuthStore.username)
const isMember = computed(() => githubAuthStore.isMember)
const isOwner = computed(() => githubAuthStore.isOwner)
const lastError = computed(() => githubAuthStore.lastError)
const canAccessMemberFeatures = computed(() => githubAuthStore.canAccessMemberFeatures)

// Status severity for the message component
const statusSeverity = computed(() => {
  if (githubAuthStore.authStatus === 'error') return 'error'
  if (!isAuthenticated.value) return 'secondary'
  if (isOwner.value) return 'success'
  if (isMember.value) return 'success'
  return 'warn'
})

// Status message text
const statusMessage = computed(() => {
  if (githubAuthStore.authStatus === 'error') {
    return lastError.value || 'Authentication failed'
  }
  if (isAuthenticating.value) {
    return 'Authenticating with GitHub...'
  }
  if (!isAuthenticated.value) {
    return 'Not logged in to GitHub'
  }
  if (isOwner.value) {
    return `Logged in as ${username.value} - Organization Owner`
  }
  if (isMember.value) {
    return `Logged in as ${username.value} - Organization Member`
  }
  return `Logged in as ${username.value} - Not a member of SlideRuleEarth`
})
</script>

<template>
  <SingleColumnLayout>
    <template v-slot:sr-single-col>
      <Card class="sr-system-card">
        <template #title>
          <div class="sr-system-title">System</div>
        </template>
        <template #content>
          <Message :severity="statusSeverity" :closable="false" class="sr-system-status">
            {{ statusMessage }}
          </Message>

          <div class="sr-system-section">
            <h4>Current Domain & Cluster</h4>
            <SrSysConfig :disabled="!isAuthenticated" />
          </div>

          <div v-if="canAccessMemberFeatures" class="sr-system-section">
            <SrDeployConfig />
          </div>

          <div v-if="isAuthenticated" class="sr-system-section">
            <SrUserInfo />
          </div>

          <div v-if="canAccessMemberFeatures" class="sr-system-section">
            <SrTokenUtil />
          </div>
        </template>
      </Card>
    </template>
  </SingleColumnLayout>
</template>

<style scoped>
.sr-system-card {
  display: block;
  justify-content: center;
  align-items: center;
  width: 40rem;
  margin: 0 auto;
  padding: 1rem;
  background: var(--surface-ground, black);
  border-radius: 10px;
  box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.08);
}

.sr-system-title {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  width: 100%;
  margin-bottom: 1rem;
}

.sr-system-status {
  margin: 0 0 1rem 0;
}

.sr-system-section {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--p-surface-border);
}

.sr-system-section:last-of-type {
  border-bottom: none;
}

.sr-system-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
  color: var(--p-text-muted-color);
}
</style>
