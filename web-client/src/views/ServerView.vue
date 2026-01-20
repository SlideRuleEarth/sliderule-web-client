<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import SrClusterEvents from '@/components/SrClusterEvents.vue'
import SrReport from '@/components/SrReport.vue'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useRoute, useRouter } from 'vue-router'

const githubAuthStore = useGitHubAuthStore()
const route = useRoute()
const router = useRouter()

// Valid tab values for validation
const validTabs = ['report', 'sysconfig', 'deployconfig', 'clusterstatus', 'clusterevents']

// Default tab based on auth: 'report' for owners, 'sysconfig' (Connection) for others
const activeTab = ref(githubAuthStore.canAccessOwnerFeatures ? 'report' : 'sysconfig')

// Update default tab when auth state becomes known (handles async auth resolution)
const hasSetInitialTab = ref(false)
watch(
  () => githubAuthStore.canAccessOwnerFeatures,
  (canAccessOwnerFeatures) => {
    if (!hasSetInitialTab.value) {
      activeTab.value = canAccessOwnerFeatures ? 'report' : 'sysconfig'
      hasSetInitialTab.value = true
    }
  },
  { immediate: true }
)

// Watch for route query parameter to switch tabs (e.g., /server?tab=deployconfig)
watch(
  () => route.query.tab,
  (tab) => {
    if (typeof tab === 'string' && validTabs.includes(tab)) {
      // Only switch to owner-only tabs if user has access
      if (tab === 'report' && !githubAuthStore.canAccessOwnerFeatures) {
        return
      }
      // Only switch to member tabs if user has access
      const memberTabs = ['deployconfig', 'clusterstatus', 'clusterevents']
      if (memberTabs.includes(tab) && !githubAuthStore.canAccessMemberFeatures) {
        return
      }
      activeTab.value = tab
    }
  },
  { immediate: true }
)

// Template refs for child components that need refresh on tab activation
const deployConfigRef = ref<{ refresh: () => void } | null>(null)
const clusterStatusRef = ref<{ refresh: () => void } | null>(null)
const clusterEventsRef = ref<{ refresh: () => void } | null>(null)
const reportRef = ref<{ refresh: () => void } | null>(null)

// Refresh data when switching to certain tabs and clear query param
watch(activeTab, (newTab) => {
  // Clear the tab query param when tab changes (keeps URL clean)
  if (route.query.tab) {
    void router.replace({ path: '/server', query: {} })
  }

  if (newTab === 'deployconfig') {
    deployConfigRef.value?.refresh()
  } else if (newTab === 'clusterstatus') {
    clusterStatusRef.value?.refresh()
  } else if (newTab === 'clusterevents') {
    clusterEventsRef.value?.refresh()
  } else if (newTab === 'report') {
    reportRef.value?.refresh()
  }
})

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
const canAccessOwnerFeatures = computed(() => githubAuthStore.canAccessOwnerFeatures)

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
              <Tab v-if="canAccessOwnerFeatures" value="report">Report</Tab>
              <Tab value="sysconfig">Connection</Tab>
              <Tab v-if="canAccessMemberFeatures" value="deployconfig">Deploy</Tab>
              <Tab v-if="canAccessMemberFeatures" value="clusterstatus">Status</Tab>
              <Tab v-if="canAccessMemberFeatures" value="clusterevents">Events</Tab>
            </TabList>
            <TabPanels>
              <TabPanel v-if="canAccessOwnerFeatures" value="report">
                <SrReport ref="reportRef" />
              </TabPanel>
              <TabPanel value="sysconfig">
                <SrSysConfig :disabled="!isAuthenticated" />
              </TabPanel>
              <TabPanel v-if="canAccessMemberFeatures" value="deployconfig">
                <SrDeployConfig ref="deployConfigRef" />
              </TabPanel>
              <TabPanel v-if="canAccessMemberFeatures" value="clusterstatus">
                <SrClusterStackStatus ref="clusterStatusRef" />
              </TabPanel>
              <TabPanel v-if="canAccessMemberFeatures" value="clusterevents">
                <SrClusterEvents ref="clusterEventsRef" />
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
