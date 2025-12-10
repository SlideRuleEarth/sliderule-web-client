<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { createLogger } from '@/utils/logger'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Button from 'primevue/button'

const logger = createLogger('GitHubCallbackView')
const route = useRoute()
const router = useRouter()
const githubAuthStore = useGitHubAuthStore()

const isProcessing = ref(true)
const errorMessage = ref<string | null>(null)

onMounted(() => {
  processCallback()
})

function processCallback() {
  logger.debug('Processing GitHub OAuth callback', { query: route.query })

  // Extract query parameters
  const params = {
    state: route.query.state as string | undefined,
    username: route.query.username as string | undefined,
    isMember: route.query.isMember as string | undefined,
    isOwner: route.query.isOwner as string | undefined,
    teams: route.query.teams as string | undefined,
    token: route.query.token as string | undefined,
    error: route.query.error as string | undefined
  }

  // Security: Immediately clear sensitive params from URL to prevent token exposure
  // in browser history, logs, and referrer headers
  if (params.token) {
    const cleanUrl = window.location.origin + window.location.pathname
    window.history.replaceState({}, document.title, cleanUrl)
    logger.debug('Cleared sensitive params from URL')
  }

  // Process the callback
  const success = githubAuthStore.handleCallback(params)

  if (success) {
    // Retrieve the stored return path or default to home
    const returnPath = sessionStorage.getItem('github_oauth_return_path') || '/'
    sessionStorage.removeItem('github_oauth_return_path')
    logger.info('GitHub OAuth callback successful, redirecting to', { returnPath })
    // Clean up URL and redirect to stored path
    void router.replace(returnPath)
  } else {
    // Show error and allow user to navigate manually
    errorMessage.value = githubAuthStore.lastError || 'Authentication failed'
    isProcessing.value = false
    logger.error('GitHub OAuth callback failed', { error: errorMessage.value })
  }
}

function goToSettings() {
  void router.push({ name: 'settings' })
}

function tryAgain() {
  errorMessage.value = null
  isProcessing.value = true
  githubAuthStore.initiateLogin()
}
</script>

<template>
  <div class="sr-github-callback">
    <div v-if="isProcessing" class="sr-processing">
      <ProgressSpinner />
      <p>Processing GitHub authentication...</p>
    </div>

    <div v-else class="sr-error-container">
      <Message severity="error" :closable="false">
        {{ errorMessage }}
      </Message>
      <div class="sr-button-row">
        <Button label="Try Again" icon="pi pi-refresh" @click="tryAgain" class="sr-retry-button" />
        <Button
          label="Go to Settings"
          icon="pi pi-cog"
          @click="goToSettings"
          severity="secondary"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sr-github-callback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  padding: 2rem;
}

.sr-processing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.sr-processing p {
  color: var(--text-color-secondary);
  font-size: 1rem;
}

.sr-error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  max-width: 400px;
}

.sr-button-row {
  display: flex;
  gap: 1rem;
}
</style>
