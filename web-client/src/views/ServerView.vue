<script setup lang="ts">
import { computed } from 'vue'
import SingleColumnLayout from '@/layouts/SingleColumnLayout.vue'
import Card from 'primevue/card'
import SrSysConfig from '@/components/SrSysConfig.vue'
import SrDeployConfig from '@/components/SrDeployConfig.vue'
import SrClusterStatus from '@/components/SrClusterStatus.vue'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

const githubAuthStore = useGitHubAuthStore()

// Auth state computed properties
const isAuthenticated = computed(() => {
  return githubAuthStore.authStatus === 'authenticated' && githubAuthStore.hasValidAuth
})
const canAccessMemberFeatures = computed(() => githubAuthStore.canAccessMemberFeatures)
</script>

<template>
  <SingleColumnLayout>
    <template v-slot:sr-single-col>
      <Card class="sr-server-card">
        <template #title>
          <div class="sr-server-title">Server</div>
        </template>
        <template #content>
          <div class="sr-server-section">
            <SrSysConfig :disabled="!isAuthenticated" />
          </div>

          <div v-if="canAccessMemberFeatures" class="sr-server-section">
            <SrDeployConfig />
          </div>

          <div v-if="canAccessMemberFeatures" class="sr-server-section">
            <SrClusterStatus />
          </div>
        </template>
      </Card>
    </template>
  </SingleColumnLayout>
</template>

<style scoped>
.sr-server-card {
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

.sr-server-title {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  width: 100%;
  margin-bottom: 1rem;
}

.sr-server-status {
  margin: 0 0 1rem 0;
}

.sr-server-section {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--p-surface-border);
}

.sr-server-section:last-of-type {
  border-bottom: none;
}

.sr-server-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
  color: var(--p-text-muted-color);
}
</style>
