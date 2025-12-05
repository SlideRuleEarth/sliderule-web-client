<template>
  <div class="sr-sys-config-container">
    <SrTextInput
      v-model="sysConfigStore.domain"
      label="Domain"
      @update:model-value="domainChanged"
    />
    <div class="sr-org-input-row">
      <label for="organization-input" class="sr-org-label">Organization</label>
      <InputText
        id="organization-input"
        v-model="sysConfigStore.organization"
        class="sr-org-input"
        @keyup.enter="orgChanged"
      />
    </div>
    <Button
      label="Login"
      icon="pi pi-sign-in"
      :disabled="computedLoggedIn || isPublicCluster"
      @click="authDialogStore.show()"
    />
    <Button
      label="Reset to Public Cluster"
      icon="pi pi-refresh"
      severity="secondary"
      @click="resetToDefaults"
    />
    <div>
      <SrClusterInfo />
    </div>
    <Button
      label="Request Nodes"
      icon="pi pi-cog"
      :disabled="!(!computedOrgIsPublic && computedLoggedIn)"
      @click="showDesiredNodesDialog = true"
    />
  </div>
  <Dialog
    class="sr-desired-nodes-dialog"
    v-model:visible="showDesiredNodesDialog"
    header="Request Nodes"
    :closable="true"
    modal
  >
    <div>
      <p>Enter the desired number of nodes and time to live:</p>
      <div class="sr-p-field">
        <label for="desired-nodes">Desired Nodes</label>
        <SrSliderInput
          v-model="desiredNodes"
          label="Desired Nodes"
          :min="1"
          :max="maxNodes"
          :defaultValue="1"
          :decimalPlaces="0"
        />
        <SrSliderInput
          v-model="ttl"
          label="Time to Live (minutes)"
          :min="15"
          :max="720"
          :defaultValue="720"
          :decimalPlaces="0"
        />
      </div>
      <div class="sr-dialog-buttons">
        <Button
          label="Cancel"
          severity="secondary"
          @click="showDesiredNodesDialog = false"
        ></Button>
        <Button label="Submit" @click="updateDesiredNodes"></Button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import SrTextInput from '@/components/SrTextInput.vue'
import SrSliderInput from '@/components/SrSliderInput.vue'
import { useToast } from 'primevue/usetoast'
import { useSrToastStore } from '@/stores/srToastStore'
import { useJwtStore } from '@/stores/SrJWTStore'
import { useAuthDialogStore } from '@/stores/authDialogStore'
import SrClusterInfo from './SrClusterInfo.vue'
import { createLogger } from '@/utils/logger'
import { authenticatedFetch } from '@/utils/fetchUtils'

const logger = createLogger('SrSysConfig')
const toast = useToast()
const srToastStore = useSrToastStore()
const sysConfigStore = useSysConfigStore()
const jwtStore = useJwtStore()
const authDialogStore = useAuthDialogStore()
const showDesiredNodesDialog = ref(false)
const desiredNodes = ref(1)
const ttl = ref(720)

// interface _orgnumNodesRsp {
//   status: string
//   min_nodes: number
//   current_nodes: number
//   max_nodes: number
//   version: string
// }

const computedOrgIsPublic = computed(() => {
  return jwtStore.getIsPublic(sysConfigStore.getDomain(), sysConfigStore.getOrganization())
})

// The "sliderule" organization is the public cluster that doesn't require login
const isPublicCluster = computed(() => {
  return sysConfigStore.getOrganization() === 'sliderule'
})

const computedLoggedIn = computed(() => {
  return jwtStore.getCredentials() !== null
})

const maxNodes = computed(() => sysConfigStore.getMaxNodes())

function domainChanged(_newDomain: string) {
  jwtStore.removeJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization())
  //console.log('Domain changed:', newDomain);
}

function orgChanged() {
  const newOrg = sysConfigStore.getOrganization()
  jwtStore.removeJwt(sysConfigStore.getDomain(), newOrg)
  // Check if new organization requires login
  if (newOrg !== 'sliderule') {
    const jwt = jwtStore.getJwt(sysConfigStore.getDomain(), newOrg)
    if (!jwt) {
      toast.add({
        severity: 'warn',
        summary: 'Authentication Required',
        detail: `Private cluster "${newOrg}" requires login.`,
        life: srToastStore.getLife()
      })
      authDialogStore.show()
    }
  }
}

async function desiredOrgNumNodes() {
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
    `${psHost}/api/desired_org_num_nodes_ttl/${sysConfigStore.getOrganization()}/${sysConfigStore.getDesiredNodes()}/${sysConfigStore.getTimeToLive()}/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    }
  )

  if (response.ok) {
    const result = await response.json()
    if (result.status === 'QUEUED') {
      toast.add({
        severity: 'info',
        summary: 'Desired Nodes Request Queued',
        detail: result.msg,
        life: srToastStore.getLife()
      })
    } else {
      logger.error('Failed to get Desired Nodes', { statusText: response.statusText })
      toast.add({
        severity: 'error',
        summary: 'Failed to Retrieve Desired Nodes',
        detail: `Error: ${result.msg}`,
        life: srToastStore.getLife()
      })
    }
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

function updateDesiredNodes() {
  logger.debug('updateDesiredNodes', { desiredNodes: desiredNodes.value, ttl: ttl.value })
  showDesiredNodesDialog.value = false // Close the dialog
  // Add your logic to update desired nodes here
  sysConfigStore.setDesiredNodes(desiredNodes.value)
  sysConfigStore.setTimeToLive(ttl.value)
  void desiredOrgNumNodes()
}

async function resetToDefaults() {
  jwtStore.clearAllJwts()
  sysConfigStore.$reset()
  // Fetch public cluster server version
  await sysConfigStore.fetchServerVersionInfo()
  await sysConfigStore.fetchCurrentNodes()
  toast.add({
    severity: 'info',
    summary: 'Reset Complete',
    detail: 'Configuration and authentication have been reset to defaults',
    life: srToastStore.getLife()
  })
}

onMounted(() => {
  logger.debug('onMounted')
})
</script>

<style scoped>
.sr-sys-config-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sr-org-name {
  font-size: medium;
  border: 1px solid rgb(65, 73, 85);
  padding: 0.25rem;
  border-radius: var(--p-border-radius);
}
.sr-user-pass-dialog {
  display: flex;
  gap: 0.75rem;
  padding-bottom: 1.25rem;
  flex-direction: column;
  justify-content: center;
  align-items: self-start;
  width: 100%;
}
.sr-p-field {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.5rem 0;
}
.sr-p-button {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}
.sr-dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.sr-org-input-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.125rem;
}

.sr-org-label {
  font-size: small;
  white-space: nowrap;
  margin-right: 0.5rem;
}

.sr-org-input {
  width: 15em;
  text-align: right;
  padding: 0.25rem;
}
</style>
