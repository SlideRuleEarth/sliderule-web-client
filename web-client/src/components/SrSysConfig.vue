<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AutoComplete from 'primevue/autocomplete'
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

const { domain, subdomain, version, cluster, current_nodes, canConnectVersion, canConnectNodes } =
  storeToRefs(sysConfigStore)

// Filtered suggestions for autocomplete
const filteredSubdomains = ref<string[]>([])

async function refreshStatus() {
  sysConfigStore.resetStatus()
  await Promise.all([sysConfigStore.fetchServerVersionInfo(), sysConfigStore.fetchCurrentNodes()])
}

// Fetch status on mount
onMounted(() => {
  void refreshStatus()
})

// Subdomain options from auth (includes 'sliderule' public subdomain)
const subDomainOptions = computed(() => {
  // If authenticated, use knownSubdomains (which includes 'sliderule')
  if (githubAuthStore.knownSubdomains?.length > 0) {
    return githubAuthStore.knownSubdomains
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

// Search/filter functions for autocomplete
function searchSubdomains(event: { query: string }) {
  const query = event.query.toLowerCase()
  const options = subDomainOptions.value
  if (!query) {
    filteredSubdomains.value = [...options]
  } else {
    filteredSubdomains.value = options.filter((s) => s.toLowerCase().includes(query))
  }
}

// Clear status display when user starts typing (clears stale red values)
function onInputChange() {
  sysConfigStore.resetStatus()
}

// Event handlers - only refresh on Enter, blur, or item select (not every keystroke)
function onSubdomainKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    void refreshStatus()
  }
}

function onSubdomainBlur() {
  void refreshStatus()
}

function onSubdomainItemSelect() {
  sysConfigStore.resetStatus()
  void refreshStatus()
}

function onDomainChange() {
  sysConfigStore.resetStatus()
  void refreshStatus()
}

// Disable reset button if already on public cluster
const isPublicCluster = computed(
  () => subdomain.value === 'sliderule' && domain.value === 'slideruleearth.io'
)

// Reset to public subdomain and domain
function resetToPublicDomain() {
  legacyJwtStore.clearAllJwts()
  sysConfigStore.$reset()
  // Set defaults: slideruleearth.io and sliderule
  domain.value = 'slideruleearth.io'
  subdomain.value = 'sliderule'
  void refreshStatus()
}
</script>

<template>
  <div class="sr-sysconfig">
    <div class="sr-sysconfig-domain-row">
      <label class="sr-sysconfig-connect-label">https://</label>
      <div class="sr-sysconfig-select-group">
        <AutoComplete
          id="sysconfig-subdomain"
          v-model="subdomain"
          :suggestions="filteredSubdomains"
          :dropdown="true"
          :forceSelection="false"
          placeholder="subdomain"
          :disabled="props.disabled"
          class="sr-sysconfig-subdomain"
          @complete="searchSubdomains"
          @input="onInputChange"
          @keydown="onSubdomainKeydown"
          @blur="onSubdomainBlur"
          @item-select="onSubdomainItemSelect"
        />
        <span class="sr-sysconfig-hint">subdomain</span>
      </div>
      <span class="sr-sysconfig-dot">.</span>
      <div class="sr-sysconfig-select-group">
        <Select
          id="sysconfig-domain"
          v-model="domain"
          :options="domainOptions"
          placeholder="domain"
          :disabled="props.disabled"
          class="sr-sysconfig-domain"
          @change="onDomainChange"
        />
        <span class="sr-sysconfig-hint">domain</span>
      </div>
    </div>
    <div class="sr-sysconfig-field">
      <label class="sr-sysconfig-label">Cluster</label>
      <span :class="['sr-sysconfig-value', `sr-status-${canConnectVersion}`]">
        {{ cluster || 'unknown' }}
      </span>
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
        @click="resetToPublicDomain"
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

.sr-sysconfig-domain-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.sr-sysconfig-connect-label {
  font-family: var(--font-family);
  font-size: 1rem;
  white-space: nowrap;
  margin-right: 0.5rem;
  color: var(--p-text-muted-color);
  align-self: flex-start;
  padding-top: 0.5rem;
}

.sr-sysconfig-select-group {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sr-sysconfig-hint {
  font-size: 0.65rem;
  color: var(--p-text-muted-color);
  margin-top: 0.15rem;
}

.sr-sysconfig-subdomain {
  width: 10em;
}

.sr-sysconfig-dot {
  font-family: var(--font-family);
  font-size: 1rem;
  font-weight: bold;
  color: var(--p-text-muted-color);
  align-self: flex-start;
  padding-top: 0.5rem;
}

.sr-sysconfig-domain {
  width: 12em;
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
