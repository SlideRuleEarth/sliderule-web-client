<script setup lang="ts">
import { ref, computed } from 'vue'
import SingleColumnLayout from '@/layouts/SingleColumnLayout.vue'
import Card from 'primevue/card'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Message from 'primevue/message'
import SrSysConfig from '@/components/SrSysConfig.vue'
import SrDeployConfig from '@/components/SrDeployConfig.vue'
import SrClusterStackStatus from '@/components/SrClusterStackStatus.vue'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

const githubAuthStore = useGitHubAuthStore()
const activeTab = ref('sysconfig')

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
      <Card class="sr-server-card">
        <template #title>
          <div class="sr-server-title">Server</div>
          <Message :severity="statusSeverity" :closable="false" class="sr-server-status">
            {{ statusMessage }}
          </Message>
        </template>
        <template #content>
          <Tabs v-model:value="activeTab">
            <TabList>
              <Tab value="sysconfig">Current Connection</Tab>
              <Tab v-if="canAccessMemberFeatures" value="deployconfig">Deploy</Tab>
              <Tab v-if="canAccessMemberFeatures" value="clusterstatus">Cluster Status</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="sysconfig">
                <SrSysConfig :disabled="!isAuthenticated" />
              </TabPanel>
              <TabPanel v-if="canAccessMemberFeatures" value="deployconfig">
                <SrDeployConfig />
              </TabPanel>
              <TabPanel v-if="canAccessMemberFeatures" value="clusterstatus">
                <SrClusterStackStatus />
              </TabPanel>
            </TabPanels>
          </Tabs>
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
