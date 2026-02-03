<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import ProgressSpinner from 'primevue/progressspinner'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/atom-one-dark.css'
import DOMPurify from 'dompurify'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import {
  fetchServerVersionInfo,
  fetchDiscoveryStatus,
  fetchProvisionerStatus,
  fetchProvisionerTestReport
} from '@/utils/fetchUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrServerInfoDialog')

hljs.registerLanguage('json', json)

interface TestSuiteResult {
  state: string
  errors: number
  passed?: number
  failed?: number
  tests?: number
  skipped?: number
  asserts?: number
  summary?: string[]
}

interface TestReport {
  status: boolean
  report?: {
    branch: string
    date: string
    status: boolean
    selftest?: TestSuiteResult
    sliderule?: TestSuiteResult
    provisioner?: TestSuiteResult
    ams?: TestSuiteResult
  }
}

interface ProvisionerStatus {
  status: boolean
  auto_shutdown?: string | null
  current_nodes?: number
  version?: string
  stack_name?: string
  response?: {
    StackStatus?: string
  }
}

const modelValue = defineModel<boolean>({ default: false })

const githubAuthStore = useGitHubAuthStore()
const sysConfigStore = useSysConfigStore()

const activeTab = ref('version')

const loadingVersion = ref(false)
const loadingDiscovery = ref(false)
const loadingProvisionerStatus = ref(false)
const loadingTestReport = ref(false)

const versionData = ref<object | null>(null)
const discoveryData = ref<object | null>(null)
const provisionerStatusData = ref<object | null>(null)
const testReportData = ref<object | null>(null)

const versionError = ref<string | null>(null)
const discoveryError = ref<string | null>(null)
const provisionerStatusError = ref<string | null>(null)
const testReportError = ref<string | null>(null)

const canAccessMemberFeatures = computed(() => githubAuthStore.canAccessMemberFeatures)

const testReport = computed(() => testReportData.value as TestReport | null)

const selftestBadge = computed(() => {
  const report = testReport.value?.report?.selftest
  if (!report) return null
  const passed = report.errors === 0
  return {
    label: 'selftest',
    status: passed ? 'passing' : 'failing',
    passed,
    detail: `${report.tests ?? 0} tests, ${report.errors} errors`
  }
})

const slideruleBadge = computed(() => {
  const report = testReport.value?.report?.sliderule
  if (!report) return null
  const passed = report.errors === 0
  const total = (report.passed ?? 0) + (report.failed ?? 0)
  return {
    label: 'sliderule',
    status: passed ? 'passing' : 'failing',
    passed,
    detail: `${report.passed ?? 0}/${total} passed`
  }
})

const provisionerBadge = computed(() => {
  const report = testReport.value?.report?.provisioner
  if (!report) return null
  const passed = report.errors === 0
  return {
    label: 'provisioner',
    status: passed ? 'passing' : 'failing',
    passed,
    detail: `${report.errors} errors`
  }
})

const amsBadge = computed(() => {
  const report = testReport.value?.report?.ams
  if (!report) return null
  const passed = report.errors === 0
  const total = (report.passed ?? 0) + (report.failed ?? 0)
  return {
    label: 'ams',
    status: passed ? 'passing' : 'failing',
    passed,
    detail: `${report.passed ?? 0}/${total} passed`
  }
})

const clusterStatusBadge = computed(() => {
  const data = provisionerStatusData.value as ProvisionerStatus | null
  if (!data) return null
  const stackStatus = data.response?.StackStatus
  const isRunning = stackStatus === 'CREATE_COMPLETE' || stackStatus === 'UPDATE_COMPLETE'

  let shutdownDetail = ''
  if (data.auto_shutdown) {
    const shutdownDate = new Date(data.auto_shutdown)
    shutdownDetail = shutdownDate.toLocaleString()
  }

  return {
    label: 'cluster',
    status: isRunning ? 'running' : (stackStatus ?? 'unknown'),
    passed: isRunning,
    shutdownLabel: data.auto_shutdown ? 'auto shutdown' : null,
    shutdownDetail
  }
})

interface DiscoveryStatus {
  nodes: number
}

interface VersionInfo {
  server?: {
    version?: string
    commit?: string
    launch?: string
    duration?: number
    packages?: string[]
  }
  icesat2?: {
    version?: string
  }
  gedi?: {
    version?: string
  }
  atl24?: {
    version?: string
  }
}

const versionBadges = computed(() => {
  const data = versionData.value as VersionInfo | null
  if (!data) return null

  const badges = []

  if (data.server?.version) {
    badges.push({
      label: 'version',
      status: data.server.version,
      passed: true
    })
  }

  if (data.server?.launch) {
    badges.push({
      label: 'launched',
      status: data.server.launch,
      passed: true,
      isInfo: true
    })
  }

  if (data.atl24?.version) {
    badges.push({
      label: 'atl24',
      status: data.atl24.version,
      passed: true
    })
  }

  return badges.length > 0 ? badges : null
})

const discoveryBadge = computed(() => {
  const data = discoveryData.value as DiscoveryStatus | null
  if (!data) return null
  const nodes = data.nodes ?? 0
  const hasNodes = nodes > 0
  return {
    label: 'nodes',
    status: nodes.toString(),
    passed: hasNodes,
    detail: hasNodes ? 'available' : 'no nodes'
  }
})

function formatJson(data: object | null): string {
  if (!data) return 'No data available'
  try {
    const prettyJson = JSON.stringify(data, null, 2)
    const result = hljs.highlight(prettyJson, { language: 'json' })
    return DOMPurify.sanitize(result.value)
  } catch {
    return 'Invalid JSON format'
  }
}

async function fetchVersionData() {
  loadingVersion.value = true
  versionError.value = null
  try {
    const result = await fetchServerVersionInfo(sysConfigStore.subdomain, sysConfigStore.domain)
    if (result.success) {
      versionData.value = result.data
    } else {
      versionError.value = 'Failed to fetch server version'
    }
  } catch (error) {
    versionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    loadingVersion.value = false
  }
}

async function fetchDiscoveryData() {
  loadingDiscovery.value = true
  discoveryError.value = null
  try {
    const result = await fetchDiscoveryStatus(sysConfigStore.subdomain, sysConfigStore.domain)
    if (result.success) {
      discoveryData.value = result.data
    } else {
      discoveryError.value = result.error || 'Failed to fetch discovery status'
    }
  } catch (error) {
    discoveryError.value = error instanceof Error ? error.message : String(error)
  } finally {
    loadingDiscovery.value = false
  }
}

async function fetchProvisionerStatusData() {
  loadingProvisionerStatus.value = true
  provisionerStatusError.value = null
  try {
    const result = await fetchProvisionerStatus(sysConfigStore.cluster)
    if (result.success) {
      provisionerStatusData.value = result.data
    } else {
      provisionerStatusError.value = result.error || 'Failed to fetch provisioner status'
    }
  } catch (error) {
    provisionerStatusError.value = error instanceof Error ? error.message : String(error)
  } finally {
    loadingProvisionerStatus.value = false
  }
}

async function fetchTestReportData() {
  loadingTestReport.value = true
  testReportError.value = null
  try {
    const result = await fetchProvisionerTestReport()
    if (result.success) {
      testReportData.value = result.data
    } else {
      testReportError.value = result.error || 'Failed to fetch test report'
    }
  } catch (error) {
    testReportError.value = error instanceof Error ? error.message : String(error)
  } finally {
    loadingTestReport.value = false
  }
}

function getCurrentTabData(): object | null {
  switch (activeTab.value) {
    case 'version':
      return versionData.value
    case 'discovery':
      return discoveryData.value
    case 'provisioner':
      return provisionerStatusData.value
    case 'tests':
      return testReportData.value
    default:
      return null
  }
}

async function copyToClipboard() {
  const data = getCurrentTabData()
  if (!data) return
  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    logger.debug('Copied to clipboard')
  } catch (err) {
    logger.error('Failed to copy', { error: err instanceof Error ? err.message : String(err) })
  }
}

watch(modelValue, (visible) => {
  if (visible) {
    void fetchVersionData()
    void fetchDiscoveryData()
    if (canAccessMemberFeatures.value) {
      void fetchProvisionerStatusData()
      void fetchTestReportData()
    }
  }
})

function refreshCurrentTab() {
  switch (activeTab.value) {
    case 'version':
      void fetchVersionData()
      break
    case 'discovery':
      void fetchDiscoveryData()
      break
    case 'provisioner':
      void fetchProvisionerStatusData()
      break
    case 'tests':
      void fetchTestReportData()
      break
  }
}
</script>

<template>
  <Dialog
    v-model:visible="modelValue"
    :modal="true"
    :closable="true"
    :style="{ width: '60vw', maxWidth: '800px' }"
  >
    <template #header>
      <div class="dialog-header">
        <Button
          label="Copy to clipboard"
          size="small"
          icon="pi pi-copy"
          @click="copyToClipboard"
          class="copy-btn"
        />
        <div class="dialog-title">About the SlideRule Server</div>
        <Button
          icon="pi pi-refresh"
          size="small"
          severity="secondary"
          text
          rounded
          @click="refreshCurrentTab"
          class="refresh-btn"
        />
      </div>
    </template>

    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="version">Version</Tab>
        <Tab value="discovery">Discovery</Tab>
        <Tab v-if="canAccessMemberFeatures" value="provisioner">Provisioner</Tab>
        <Tab v-if="canAccessMemberFeatures" value="tests">Tests</Tab>
      </TabList>

      <TabPanels>
        <TabPanel value="version">
          <div v-if="loadingVersion" class="loading-container">
            <ProgressSpinner style="width: 2rem; height: 2rem" />
            <span>Loading version info...</span>
          </div>
          <div v-else-if="versionError" class="error-container">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{{ versionError }}</span>
          </div>
          <template v-else>
            <div v-if="versionBadges" class="test-badges">
              <div v-for="badge in versionBadges" :key="badge.label" class="github-badge">
                <span class="badge-label">{{ badge.label }}</span>
                <span class="badge-status" :class="badge.isInfo ? 'badge-info' : 'badge-passing'">
                  {{ badge.status }}
                </span>
              </div>
            </div>
            <pre v-html="formatJson(versionData)"></pre>
          </template>
        </TabPanel>

        <TabPanel value="discovery">
          <div v-if="loadingDiscovery" class="loading-container">
            <ProgressSpinner style="width: 2rem; height: 2rem" />
            <span>Loading discovery status...</span>
          </div>
          <div v-else-if="discoveryError" class="error-container">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{{ discoveryError }}</span>
          </div>
          <template v-else>
            <div v-if="discoveryBadge" class="test-badges">
              <div class="github-badge">
                <span class="badge-label">{{ discoveryBadge.label }}</span>
                <span
                  class="badge-status"
                  :class="discoveryBadge.passed ? 'badge-passing' : 'badge-failing'"
                >
                  {{ discoveryBadge.status }}
                </span>
                <span class="badge-detail">{{ discoveryBadge.detail }}</span>
              </div>
            </div>
            <pre v-html="formatJson(discoveryData)"></pre>
          </template>
        </TabPanel>

        <TabPanel v-if="canAccessMemberFeatures" value="provisioner">
          <div v-if="loadingProvisionerStatus" class="loading-container">
            <ProgressSpinner style="width: 2rem; height: 2rem" />
            <span>Loading provisioner status...</span>
          </div>
          <div v-else-if="provisionerStatusError" class="error-container">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{{ provisionerStatusError }}</span>
          </div>
          <template v-else>
            <div v-if="clusterStatusBadge" class="test-badges">
              <div class="github-badge">
                <span class="badge-label">{{ clusterStatusBadge.label }}</span>
                <span
                  class="badge-status"
                  :class="clusterStatusBadge.passed ? 'badge-passing' : 'badge-failing'"
                >
                  {{ clusterStatusBadge.status }}
                </span>
              </div>
              <div v-if="clusterStatusBadge.shutdownLabel" class="github-badge">
                <span class="badge-label">{{ clusterStatusBadge.shutdownLabel }}</span>
                <span class="badge-status badge-info">
                  {{ clusterStatusBadge.shutdownDetail }}
                </span>
              </div>
            </div>
            <pre v-html="formatJson(provisionerStatusData)"></pre>
          </template>
        </TabPanel>

        <TabPanel v-if="canAccessMemberFeatures" value="tests">
          <div v-if="loadingTestReport" class="loading-container">
            <ProgressSpinner style="width: 2rem; height: 2rem" />
            <span>Loading test report...</span>
          </div>
          <div v-else-if="testReportError" class="error-container">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{{ testReportError }}</span>
          </div>
          <template v-else>
            <div class="test-badges">
              <div v-if="selftestBadge" class="github-badge">
                <span class="badge-label">{{ selftestBadge.label }}</span>
                <span
                  class="badge-status"
                  :class="selftestBadge.passed ? 'badge-passing' : 'badge-failing'"
                >
                  {{ selftestBadge.status }}
                </span>
                <span class="badge-detail">{{ selftestBadge.detail }}</span>
              </div>
              <div v-if="slideruleBadge" class="github-badge">
                <span class="badge-label">{{ slideruleBadge.label }}</span>
                <span
                  class="badge-status"
                  :class="slideruleBadge.passed ? 'badge-passing' : 'badge-failing'"
                >
                  {{ slideruleBadge.status }}
                </span>
                <span class="badge-detail">{{ slideruleBadge.detail }}</span>
              </div>
              <div v-if="provisionerBadge" class="github-badge">
                <span class="badge-label">{{ provisionerBadge.label }}</span>
                <span
                  class="badge-status"
                  :class="provisionerBadge.passed ? 'badge-passing' : 'badge-failing'"
                >
                  {{ provisionerBadge.status }}
                </span>
                <span class="badge-detail">{{ provisionerBadge.detail }}</span>
              </div>
              <div v-if="amsBadge" class="github-badge">
                <span class="badge-label">{{ amsBadge.label }}</span>
                <span
                  class="badge-status"
                  :class="amsBadge.passed ? 'badge-passing' : 'badge-failing'"
                >
                  {{ amsBadge.status }}
                </span>
                <span class="badge-detail">{{ amsBadge.detail }}</span>
              </div>
            </div>
            <pre v-html="formatJson(testReportData)"></pre>
          </template>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>

<style scoped>
pre {
  background-color: #1e1e1e;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.85rem;
  max-height: 400px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 1rem;
}

.copy-btn {
  flex-shrink: 0;
}

.refresh-btn {
  flex-shrink: 0;
}

.dialog-title {
  flex: 1;
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
}

.loading-container,
.error-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  justify-content: center;
}

.error-container {
  color: var(--p-red-500);
}

:deep(.p-tab) {
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
}

:deep(.p-tabpanels) {
  padding-top: 0.5rem;
  min-height: 450px;
}

.test-badges {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.github-badge {
  display: inline-flex;
  font-family: 'Verdana', 'DejaVu Sans', Geneva, sans-serif;
  font-size: 11px;
  border-radius: 4px;
  overflow: hidden;
  cursor: default;
}

.badge-label {
  background-color: #555;
  color: #fff;
  padding: 4px 8px;
}

.badge-status {
  padding: 4px 8px;
  color: #fff;
  font-weight: 600;
}

.badge-passing {
  background-color: #4c1;
}

.badge-failing {
  background-color: #e05d44;
}

.badge-info {
  background-color: #007ec6;
}

.badge-detail {
  background-color: #333;
  color: #aaa;
  padding: 4px 8px;
  font-weight: normal;
}
</style>
