<template>
  <Fieldset legend="Cluster Status" :toggleable="true" :collapsed="false">
    <div class="p-field">
      <label>Type:</label>
      <span>{{ computedGetType }}</span>
    </div>
    <div class="p-field">
      <label>Min Nodes:</label>
      <span>{{ minNodes }}</span>
    </div>
    <div class="p-field">
      <label>Current Nodes:</label>
      <span>{{ currentNodes }}</span>
    </div>
    <div class="p-field">
      <label>Max Nodes:</label>
      <span>{{ maxNodes }}</span>
    </div>
    <div class="p-field">
      <label>Version:</label>
      <span>{{ version }}</span>
    </div>
    <div class="sr-refresh-btn">
      <Button
        icon="pi pi-refresh"
        :disabled="!computedLoggedIn"
        size="small"
        @click="getOrgNumNodes"
      />
    </div>
  </Fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { useJwtStore } from '@/stores/SrJWTStore'
import Fieldset from 'primevue/fieldset'
import { useToast } from 'primevue/usetoast'
import { useSrToastStore } from '@/stores/srToastStore'
import Button from 'primevue/button'
import { createLogger } from '@/utils/logger'
import { authenticatedFetch } from '@/utils/fetchUtils'

const logger = createLogger('SrClusterInfo')

// Use the store
const sysConfigStore = useSysConfigStore()
const jwtStore = useJwtStore()
const toast = useToast()
const srToastStore = useSrToastStore()

const computedLoggedIn = computed(() => {
  const cred = jwtStore.getCredentials()
  return cred !== null
})
// Computed properties to access state
const computedGetType = computed(() => {
  logger.debug('computedGetType', { computedLoggedIn: computedLoggedIn.value })
  if (!computedLoggedIn.value) {
    return 'Unknown'
  } else {
    return jwtStore.getIsPublic(sysConfigStore.getDomain(), sysConfigStore.getOrganization())
      ? 'Public'
      : 'Private'
  }
})
const minNodes = computed(() => sysConfigStore.getMinNodes())
const currentNodes = computed(() => sysConfigStore.getCurrentNodes())
const maxNodes = computed(() => sysConfigStore.getMaxNodes())
const version = computed(() => sysConfigStore.getVersion())

async function getOrgNumNodes() {
  // Check if logged in first
  if (!jwtStore.getCredentials()) {
    logger.error('Login expired or not logged in')
    toast.add({
      severity: 'info',
      summary: 'Need to Login',
      detail: 'Please log in again',
      life: srToastStore.getLife()
    })
    return
  }

  const psHost = `https://ps.${sysConfigStore.getDomain()}`
  // Use authenticatedFetch - it handles JWT header and 401 retry automatically
  const response = await authenticatedFetch(
    `${psHost}/api/org_num_nodes/${sysConfigStore.getOrganization()}/`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    }
  )

  if (response.ok) {
    const result = await response.json()
    logger.debug('getOrgNumNodes result', { result })
    sysConfigStore.setMinNodes(result.min_nodes)
    sysConfigStore.setCurrentNodes(result.current_nodes)
    sysConfigStore.setMaxNodes(result.max_nodes)
    sysConfigStore.setVersion(result.version)
    jwtStore.setIsPublic(
      sysConfigStore.getDomain(),
      sysConfigStore.getOrganization(),
      result.is_public
    )
    toast.add({
      severity: 'info',
      summary: 'Num Nodes Retrieved',
      detail: `Min: ${result.min_nodes}, Current: ${result.current_nodes}, Max: ${result.max_nodes}`,
      life: srToastStore.getLife()
    })
  } else if (response.status === 401) {
    // 401 after retry means refresh token also expired
    logger.error('Authentication failed - please log in again')
    toast.add({
      severity: 'info',
      summary: 'Session Expired',
      detail: 'Please log in again',
      life: srToastStore.getLife()
    })
  } else {
    logger.error('Failed to get Num Nodes', { statusText: response.statusText })
    toast.add({
      severity: 'error',
      summary: 'Failed to Retrieve Nodes',
      detail: `Error: ${response.statusText}`,
      life: srToastStore.getLife()
    })
  }
}
</script>

<style scoped>
.p-field {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}
.sr-refresh-btn {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}
label {
  font-weight: bold;
}
</style>
