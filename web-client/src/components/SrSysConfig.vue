<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { useLegacyJwtStore } from '@/stores/SrLegacyJwtStore'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  disabled?: boolean
}>()

const githubAuthStore = useGitHubAuthStore()
const sysConfigStore = useSysConfigStore()
const legacyJwtStore = useLegacyJwtStore()

const { domain, cluster, version, current_nodes, canConnectVersion, canConnectNodes } =
  storeToRefs(sysConfigStore)

async function refreshStatus() {
  sysConfigStore.resetStatus()
  await Promise.all([sysConfigStore.fetchServerVersionInfo(), sysConfigStore.fetchCurrentNodes()])
}

// Refresh status when domain or cluster changes
watch([domain, cluster], () => {
  void refreshStatus()
})

// Fetch status on mount
onMounted(() => {
  void refreshStatus()
})

// Cluster options from auth (includes 'sliderule' public cluster)
const clusterOptions = computed(() => {
  // If authenticated, use knownClusters (which includes 'sliderule')
  if (githubAuthStore.knownClusters?.length > 0) {
    return githubAuthStore.knownClusters
  }
  // Fallback for non-authenticated users
  return ['sliderule']
})

// Available domain options - testsliderule.org only for org owners
const domainOptions = computed(() => {
  if (githubAuthStore.isOwner) {
    return ['testsliderule.org', 'slideruleearth.io']
  }
  return ['slideruleearth.io']
})

// Disable reset button if already on public cluster
const isPublicCluster = computed(
  () => cluster.value === 'sliderule' && domain.value === 'slideruleearth.io'
)

// Reset to public cluster
async function resetToPublicCluster() {
  legacyJwtStore.clearAllJwts()
  sysConfigStore.$reset()
  // Set defaults: slideruleearth.io and sliderule
  domain.value = 'slideruleearth.io'
  cluster.value = 'sliderule'
  // Note: watch will trigger refreshStatus automatically
}
</script>

<template>
  <div class="sr-sysconfig">
    <h4 class="sr-sysconfig-header">Current Domain & Cluster</h4>
    <div class="sr-sysconfig-field">
      <label for="sysconfig-domain" class="sr-sysconfig-label">Domain</label>
      <Select
        id="sysconfig-domain"
        v-model="domain"
        :options="domainOptions"
        :disabled="props.disabled"
        class="sr-sysconfig-select"
      />
    </div>
    <div class="sr-sysconfig-field">
      <label for="sysconfig-cluster" class="sr-sysconfig-label">Cluster</label>
      <Select
        id="sysconfig-cluster"
        v-model="cluster"
        :editable="true"
        :options="clusterOptions"
        :disabled="props.disabled"
        class="sr-sysconfig-select"
      />
    </div>
    <div class="sr-sysconfig-field">
      <label class="sr-sysconfig-label">Version</label>
      <span :class="['sr-sysconfig-value', `sr-status-${canConnectVersion}`]">
        {{ version || 'v?.?.?' }}
      </span>
    </div>
    <div class="sr-sysconfig-field">
      <label class="sr-sysconfig-label">Current Nodes</label>
      <span :class="['sr-sysconfig-value', `sr-status-${canConnectNodes}`]">
        {{ current_nodes >= 0 ? current_nodes : '-' }}
      </span>
    </div>
    <div class="sr-sysconfig-button-row">
      <Button
        v-if="!props.disabled"
        label="Reset to Public Cluster"
        icon="pi pi-undo"
        class="sr-glow-button"
        variant="text"
        rounded
        :disabled="isPublicCluster"
        @click="resetToPublicCluster"
      />
      <Button
        label="Refresh Status"
        icon="pi pi-refresh"
        class="sr-glow-button sr-refresh-btn"
        variant="text"
        rounded
        @click="refreshStatus"
      />
    </div>
  </div>
</template>

<style scoped>
.sr-sysconfig {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.sr-sysconfig-header {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
  color: var(--p-primary-color);
}

.sr-sysconfig-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sr-sysconfig-label {
  font-size: small;
  white-space: nowrap;
  margin-right: 0.5rem;
}

.sr-sysconfig-select {
  width: 15em;
}

.sr-sysconfig-value {
  font-size: small;
  min-width: 15em;
  text-align: right;
}

.sr-status-yes {
  color: var(--p-green-500);
}

.sr-status-no {
  color: var(--p-red-500);
}

.sr-status-unknown {
  color: var(--p-text-muted-color);
}

.sr-sysconfig-button-row {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
}

.sr-refresh-btn {
  margin-left: auto;
}
</style>
