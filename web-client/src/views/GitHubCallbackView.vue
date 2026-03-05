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
  processCallback().catch((err) => {
    errorMessage.value =
      err instanceof Error ? err.message : 'Unexpected error during authentication'
    isProcessing.value = false
    logger.error('Unhandled error in processCallback', { error: String(err) })
  })
})

async function processCallback() {
  logger.debug('Processing GitHub OAuth callback', { query: route.query })

  // Extract only the params that the OAuth 2.1 flow returns
  const params = {
    code: route.query.code as string | undefined,
    state: route.query.state as string | undefined,
    error: route.query.error as string | undefined
  }

  // Security: Clear URL params immediately (code is single-use but still sensitive)
  if (params.code || params.error) {
    const cleanUrl = window.location.origin + window.location.pathname
    window.history.replaceState({}, document.title, cleanUrl)
    logger.debug('Cleared params from URL')
  }

  // Exchange authorization code for token (async)
  const success = await githubAuthStore.exchangeCodeForToken(params)

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
  void githubAuthStore.initiateLogin()
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
