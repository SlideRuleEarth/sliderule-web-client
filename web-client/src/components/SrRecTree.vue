<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import TreeTable from 'primevue/treetable'
import Column from 'primevue/column'
import type { TreeNode } from 'primevue/treenode'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import router from '@/router/index.js'
import Dialog from 'primevue/dialog'

import { useRequestsStore } from '@/stores/requestsStore'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { db } from '@/db/SlideRuleDb'
//import router from '@/router/index';
import { deleteOpfsFile } from '@/utils/SrParquetUtils'
import { cleanupDelAllRequests } from '@/utils/storageUtils'
import SrCustomTooltip from './SrCustomTooltip.vue'
import SrEditDesc from './SrEditDesc.vue'
import { useSrToastStore } from '@/stores/srToastStore'
import { formatBytes } from '@/utils/SrParquetUtils'
import SrJsonDisplayDialog from './SrJsonDisplayDialog.vue'
import SrImportParquetFile from './SrImportParquetFile.vue'
import ToggleButton from 'primevue/togglebutton'
import SrExportDialog from '@/components/SrExportDialog.vue'
import SrParmsFormatTabs from '@/components/SrParmsFormatTabs.vue'
import { updateElevationMap } from '@/utils/SrMapUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrRecTree')
const requestsStore = useRequestsStore()
const recTreeStore = useRecTreeStore()
const srToastStore = useSrToastStore()
const toast = useToast()

const treeNodes = ref<TreeNode[]>([])
const tooltipRef = ref()

// -- Dialog state for "svr_parms"
const showSvrParmsDialog = ref(false)
const currentSvrParms = ref('')

// -- Dialog state for combined parameters view with tabs
const showCombinedParmsDialog = ref(false)
const currentRcvdParmsObj = ref<object | null>(null)
const currentSentParmsObj = ref<object | null>(null)
const currentFunc = ref('')
const currentReqId = ref<number | null>(null)

// -- Dialog state for "geo_metadata"
const showGeoMetadataDialog = ref(false)
const currentGeoMetadata = ref('')

const onlySuccess = ref(false)

const exportReqId = ref(0)
const showExportDialog = ref(false)
const isCleaningUp = ref(false)

// Open the Svr Parms dialog
function openSvrParmsDialog(params: string | object | null | undefined) {
  // Check if params is null, undefined, or empty
  if (!params) {
    logger.warn('openSvrParmsDialog called with no params')
    srToastStore.warn(
      'No Server Parameters',
      'This request does not have server parameters available. The request may still be processing or failed before the server could return parameters.'
    )
    return
  }

  // Check if params is an empty object
  if (typeof params === 'object' && Object.keys(params).length === 0) {
    logger.warn('openSvrParmsDialog called with empty params object')
    srToastStore.warn('No Server Parameters', 'Server parameters are empty for this request.')
    return
  }

  if (typeof params === 'object') {
    currentSvrParms.value = JSON.stringify(params, null, 2)
  } else {
    currentSvrParms.value = params
  }
  showSvrParmsDialog.value = true
}

// Open the Geo Metadata dialog
function openGeoMetadataDialog(metadata: string | object) {
  if (typeof metadata === 'object') {
    currentGeoMetadata.value = JSON.stringify(metadata, null, 2)
  } else {
    currentGeoMetadata.value = metadata
  }
  showGeoMetadataDialog.value = true
}

// Open the Combined Parameters dialog
function openCombinedParmsDialog(rcvdParms: any, sentParms: any, func: string, reqId: number) {
  // Store rcvdParms for SrParmsFormatTabs (it handles parms wrapper stripping internally)
  currentRcvdParmsObj.value = rcvdParms
  currentSentParmsObj.value = sentParms
  currentFunc.value = func || ''
  currentReqId.value = reqId
  showCombinedParmsDialog.value = true
}

const analyze = async (id: number) => {
  try {
    if (recTreeStore.findAndSelectNode(id)) {
      toast.add({
        severity: 'info',
        summary: 'Loading Record',
        detail: 'Preparing elevation data...',
        life: 5000
      })
      await updateElevationMap(id)
    } else {
      toast.add({
        severity: 'error',
        summary: 'Invalid Record Id',
        detail: 'Failed to set record Id',
        life: srToastStore.getLife()
      })
    }
  } catch (error) {
    logger.error('Failed to analyze request', {
      id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

async function deleteRequest(id: number) {
  let deleted = true
  let fileNotFound = false
  try {
    const fn = await db.getFilename(id)
    const result = await deleteOpfsFile(fn)
    fileNotFound = result.fileNotFound
    if (!result.deleted) {
      deleted = false
    }
  } catch (error) {
    logger.error('Failed to delete file', {
      id,
      error: error instanceof Error ? error.message : String(error)
    })
    deleted = false
  }
  try {
    deleted = await requestsStore.deleteReq(id)
    if (deleted) {
      const detail = fileNotFound
        ? `Record ${id} deleted (no data file found - record had no data points)`
        : `Record ${id} deleted successfully`
      toast.add({
        severity: 'success',
        summary: 'Record Deleted',
        detail: detail,
        life: srToastStore.getLife()
      })
    } else {
      toast.add({
        severity: 'error',
        summary: 'Record Deletion Failed',
        detail: `Failed to delete record ${id}`,
        life: srToastStore.getLife()
      })
    }
  } catch (error) {
    logger.error('Failed to delete record', {
      id,
      error: error instanceof Error ? error.message : String(error)
    })
    deleted = false
  }
  return deleted
}

const deleteReqAndChildren = async (id: number) => {
  const children = await db.runContexts.where('parentReqId').equals(id).toArray()
  const listOfChildIds = children.map((child) => child.reqId)
  let msg = `Are you sure you want to delete this record ${id}`
  if (children.length > 0) {
    msg += ` and all its children: ${listOfChildIds}`
  }

  const userConfirmed = window.confirm(msg)
  let deleteSuccessful = true
  if (userConfirmed) {
    if (children.length > 0) {
      for (const child of children) {
        deleteSuccessful = deleteSuccessful && (await deleteRequest(child.reqId))
      }
    }
    deleteSuccessful = deleteSuccessful && (await deleteRequest(id))
  } else {
    toast.add({
      severity: 'warn',
      summary: 'Deletion Cancelled',
      detail: `Record ${id} was NOT deleted`,
      life: srToastStore.getLife()
    })
    return false
  }
  if (!deleteSuccessful) {
    toast.add({
      severity: 'error',
      summary: 'Record Deletion Failed',
      detail: `Failed to delete record ${id}`,
      life: srToastStore.getLife()
    })
  }
  treeNodes.value = await requestsStore.getTreeTableNodes(onlySuccess.value)
  await recTreeStore.loadTreeData()
  recTreeStore.initToFirstRecord()
  return deleteSuccessful
}

const deleteAllReqs = async () => {
  await cleanupDelAllRequests()
  treeNodes.value = await requestsStore.getTreeTableNodes(onlySuccess.value)
  await recTreeStore.loadTreeData()
  recTreeStore.initToFirstRecord()
}

const handleToggle = async () => {
  treeNodes.value = await requestsStore.getTreeTableNodes(onlySuccess.value)
}

const confirmDeleteAllReqs = async () => {
  const userConfirmed = window.confirm('Are you sure you want to delete all requests?')
  if (userConfirmed) {
    await deleteAllReqs()
  }
}

const exportFile = (req_id: number) => {
  logger.debug('Exporting file', { req_id })
  exportReqId.value = req_id
  showExportDialog.value = true
}

const goToRequestViewAndLoadParms = async (req_id: number) => {
  try {
    // Navigate to Request view with reqId as a URL parameter
    // The RequestView will detect this and load the params after it mounts
    logger.debug('Navigating to request view', { req_id, path: `/request/${req_id}` })
    await router.push(`/request/${req_id}`)
  } catch (error) {
    logger.error('Failed to navigate to request view', {
      req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    toast.add({
      severity: 'error',
      summary: 'Navigation Failed',
      detail: `Failed to navigate to request view`,
      life: srToastStore.getLife()
    })
  }
}

const handleFileImported = async (reqId: string) => {
  logger.debug('File import completed', { reqId })
  treeNodes.value = await requestsStore.getTreeTableNodes(onlySuccess.value)
}

onMounted(async () => {
  isCleaningUp.value = true
  await requestsStore.cleanupAllRequests()
  isCleaningUp.value = false
  requestsStore.watchReqTable()
  treeNodes.value = await requestsStore.getTreeTableNodes(onlySuccess.value)
  //console.log('treeNodes.value:', treeNodes.value);
})

onUnmounted(() => {
  requestsStore.unWatchReqTable()
})
</script>

<template>
  <div v-if="isCleaningUp" class="cleanup-overlay">
    <div class="cleanup-spinner">
      <i class="pi pi-spin pi-spinner" style="font-size: 3rem"></i>
      <p>Loading requests...</p>
    </div>
  </div>
  <SrExportDialog v-model="showExportDialog" :reqId="exportReqId" />
  <TreeTable
    :value="treeNodes"
    size="small"
    paginator
    :rows="10"
    :rowsPerPageOptions="[3, 5, 10, 15, 20, 25, 50]"
  >
    <template #paginatorstart>
      <ToggleButton
        v-model="onlySuccess"
        @change="handleToggle"
        onLabel="Only Successful"
        offLabel="Show All"
        :onIcon="'pi pi-check'"
        :offIcon="'pi pi-times'"
      />
    </template>
    <Column field="reqId" expander>
      <template #header>
        <div style="text-align: right; width: 100%">ID</div>
      </template>
      <template #body="slotProps">
        <span
          @mouseover="
            tooltipRef?.showTooltip(
              $event,
              [
                slotProps.node.data.description
                  ? `<strong>${slotProps.node.data.description}</strong>`
                  : null,
                slotProps.node.data.srViewName ? `View: ${slotProps.node.data.srViewName}` : null
              ]
                .filter(Boolean)
                .join('<br>') || 'No description available'
            )
          "
          @mouseleave="tooltipRef?.hideTooltip"
          style="cursor: help"
        >
          {{ slotProps.node.data.reqId }}
        </span>
      </template>
    </Column>
    <Column field="func">
      <template #header>
        <div style="text-align: center; width: 100%">Api</div>
      </template>
    </Column>
    <Column field="status">
      <template #header>
        <div style="text-align: center; width: 100%">Status</div>
      </template>
    </Column>
    <!-- Request Parameters Button & Dialog -->
    <Column field="parameters" class="sr-par-fmt">
      <template #header>
        <div style="text-align: center; width: 100%">Request</div>
      </template>
      <template #body="slotProps">
        <Button
          icon="pi pi-eye"
          label="Parms"
          class="sr-glow-button"
          @click="
            openCombinedParmsDialog(
              slotProps.node.data.rcvd_parms,
              slotProps.node.data.parameters,
              slotProps.node.data.func,
              slotProps.node.data.reqId
            )
          "
          @mouseover="
            tooltipRef?.showTooltip($event, 'View request parameters (sent and received)')
          "
          @mouseleave="tooltipRef?.hideTooltip"
          variant="text"
          rounded
        ></Button>
        <Button
          icon="pi pi-sliders-h"
          class="sr-glow-button p-button-icon-only"
          @click="goToRequestViewAndLoadParms(slotProps.node.data.reqId)"
          @mouseover="
            tooltipRef?.showTooltip(
              $event,
              'Load the parms we received back from the server into Request view'
            )
          "
          @mouseleave="tooltipRef?.hideTooltip"
          variant="text"
          rounded
        ></Button>
      </template>
    </Column>
    <!-- Server Parameters Button & Dialog -->
    <Column field="svr_parms" class="sr-par-fmt">
      <template #header>
        <div
          style="text-align: center; width: 100%"
          @mouseover="
            tooltipRef?.showTooltip(
              $event,
              'Parameters used by the server for this request (including defaulted parameters)'
            )
          "
          @mouseleave="tooltipRef?.hideTooltip"
        >
          Svr State
        </div>
      </template>
      <template #body="slotProps">
        <Button
          icon="pi pi-eye"
          label="View"
          class="sr-glow-button"
          @click="openSvrParmsDialog(slotProps.node.data.svr_parms)"
          @mouseover="
            tooltipRef?.showTooltip(
              $event,
              'View Server Parameters (includes defaulted parameters)'
            )
          "
          @mouseleave="tooltipRef?.hideTooltip"
          variant="text"
          rounded
        ></Button>
      </template>
    </Column>
    <Column field="Actions" class="sr-analyze">
      <template #header>
        <div style="text-align: center; width: 100%">Analyze</div>
      </template>
      <template #body="slotProps">
        <Button
          v-if="
            slotProps.node.data.status === 'success' || slotProps.node.data.status === 'imported'
          "
          icon="pi pi-chart-line"
          class="sr-glow-button p-button-icon-only"
          @click="analyze(slotProps.node.data.reqId)"
          @mouseover="tooltipRef?.showTooltip($event, `Analyze ${slotProps.node.data.reqId}`)"
          @mouseleave="tooltipRef?.hideTooltip"
          variant="text"
          rounded
        ></Button>
      </template>
    </Column>

    <!-- Editable Description -->
    <Column
      field="description"
      header="Description"
      :editable="true"
      style="width: 15rem; max-width: 20rem"
    >
      <template #header>
        <div style="text-align: center; width: 100%">
          <i
            class="pi pi-pencil"
            @mouseover="tooltipRef?.showTooltip($event, 'Editable Description')"
            @mouseleave="tooltipRef?.hideTooltip"
          ></i>
        </div>
      </template>
      <template #body="slotProps">
        <SrEditDesc :reqId="slotProps.node.data.reqId" label="" />
      </template>
    </Column>
    <!-- Geo Metadata Button & Dialog -->
    <Column field="geo_metadata" class="sr-par-fmt">
      <template #header>
        <div style="text-align: center; width: 100%">Geo Metadata</div>
      </template>
      <template #body="slotProps">
        <Button
          v-if="slotProps.node.data.geo_metadata"
          icon="pi pi-eye"
          label="View"
          class="sr-glow-button"
          @click="openGeoMetadataDialog(slotProps.node.data.geo_metadata)"
          @mouseover="tooltipRef?.showTooltip($event, 'View Geo Metadata')"
          @mouseleave="tooltipRef?.hideTooltip"
          variant="text"
          rounded
        ></Button>
        <div v-else class="sr-empty-cell">—</div>
      </template>
    </Column>
    <Column field="crs" style="width: 10rem">
      <template #header>
        <div style="text-align: center; width: 100%">CRS</div>
      </template>
      <template #body="slotProps">
        <span v-if="slotProps.node.data.geo_metadata?.columns?.geometry?.crs?.id">
          {{ slotProps.node.data.geo_metadata.columns.geometry.crs.id.authority }}:{{
            slotProps.node.data.geo_metadata.columns.geometry.crs.id.code
          }}
        </span>
        <span v-else-if="slotProps.node.data.geo_metadata?.columns?.geometry?.crs?.name">
          {{ slotProps.node.data.geo_metadata.columns.geometry.crs.name }}
        </span>
        <div v-else class="sr-empty-cell">—</div>
      </template>
    </Column>
    <Column field="cnt">
      <template #header>
        <div style="text-align: left; width: 100%">Count</div>
      </template>
      <template #body="slotProps">
        {{ new Intl.NumberFormat().format(parseInt(slotProps.node.data.cnt)) }}
      </template>
    </Column>
    <Column field="num_bytes">
      <template #header>
        <div style="text-align: left; width: 100%">Size</div>
      </template>
      <template #body="slotProps">
        {{ formatBytes(slotProps.node.data.num_bytes) }}
      </template>
    </Column>
    <Column field="num_gran">
      <template #header>
        <div style="text-align: left; width: 100%"># Granules</div>
      </template>
      <template #body="slotProps">
        <span v-if="slotProps.node.data.num_gran > 0">
          {{ new Intl.NumberFormat().format(slotProps.node.data.num_gran) }}
        </span>
        <span v-else>—</span>
      </template>
    </Column>

    <Column field="area_of_poly">
      <template #header>
        <div style="text-align: left; width: 100%">Area</div>
      </template>
      <template #body="slotProps">
        <span v-if="Number.isFinite(slotProps.node.data.area_of_poly)">
          {{
            slotProps.node.data.area_of_poly.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })
          }}
          km²
        </span>
        <span v-else>—</span>
      </template>
    </Column>
    <Column field="elapsed_time" style="width: 10%">
      <template #header>
        <div style="text-align: left; width: 100%">Elapsed Time</div>
      </template>
    </Column>
    <Column field="Actions" header="" class="sr-export">
      <template #header>
        <div
          class="sr-file-import"
          @mouseover="tooltipRef.showTooltip($event, 'Import a SlideRule Parquet File')"
          @mouseleave="tooltipRef.hideTooltip()"
        >
          <SrImportParquetFile :iconOnly="true" @file-imported="handleFileImported" />
        </div>
      </template>
      <template #body="slotProps">
        <Button
          icon="pi pi-file-export"
          class="sr-glow-button p-button-icon-only"
          @click="exportFile(slotProps.node.data.reqId)"
          @mouseover="tooltipRef?.showTooltip($event, 'Export File')"
          @mouseleave="tooltipRef?.hideTooltip"
          aria-label="Export"
          variant="text"
          rounded
        />
      </template>
    </Column>

    <Column field="Actions" header="" class="sr-delete">
      <template #header>
        <Button
          icon="pi pi-trash"
          severity="danger"
          class="sr-glow-button p-button-icon-only"
          @click="confirmDeleteAllReqs()"
          @mouseover="tooltipRef?.showTooltip($event, 'Delete ALL Requests')"
          @mouseleave="tooltipRef?.hideTooltip"
          variant="text"
          rounded
        ></Button>
      </template>
      <template #body="slotProps">
        <Button
          icon="pi pi-trash"
          severity="danger"
          class="sr-glow-button p-button-icon-only"
          @click="deleteReqAndChildren(slotProps.node.data.reqId)"
          @mouseover="
            tooltipRef?.showTooltip($event, 'Delete this request and any of its children')
          "
          @mouseleave="tooltipRef?.hideTooltip"
          variant="text"
          rounded
        ></Button>
      </template>
    </Column>
  </TreeTable>

  <!-- Combined Request Parameters Dialog -->
  <Dialog
    v-model:visible="showCombinedParmsDialog"
    :header="`Record ${currentReqId} Request Parameters`"
    :style="{ width: '80vw' }"
    :modal="true"
    :dismissableMask="true"
  >
    <SrParmsFormatTabs
      v-if="currentRcvdParmsObj || currentSentParmsObj"
      :rcvdParms="currentRcvdParmsObj"
      :sentParms="currentSentParmsObj"
      :endpoint="currentFunc"
    />
    <div v-else style="padding: 1rem; text-align: center; color: #999">No parameters available</div>
  </Dialog>
  <!-- Server Parameters Dialog -->
  <SrJsonDisplayDialog
    v-model:visible="showSvrParmsDialog"
    :json-data="currentSvrParms"
    title="Server Parameters"
    width="50vw"
  />
  <!-- Geo Metadata Dialog -->
  <SrJsonDisplayDialog
    v-model:visible="showGeoMetadataDialog"
    :json-data="currentGeoMetadata"
    title="Geo Metadata"
    width="50vw"
  />
  <!-- Custom Tooltip -->
  <SrCustomTooltip ref="tooltipRef" id="recTreeTooltip" />

  <!-- Display an error message if there is an error -->
  <div v-if="requestsStore.autoFetchError" class="error-message">
    {{ requestsStore.autoFetchErrorMsg }}
  </div>
</template>

<style scoped>
.cleanup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.cleanup-spinner {
  background-color: var(--p-surface-card, #1e1e1e);
  border-radius: 8px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.cleanup-spinner i {
  color: var(--p-primary-color, #3b82f6);
}

.cleanup-spinner p {
  margin: 0;
  font-size: 1.1rem;
  color: var(--p-text-color, white);
}

:deep(.p-icon) {
  color: var(--p-primary-color, white); /* fallback to white */
}

.p-button-sm .p-button-icon {
  font-size: var(--p-button-sm-font-size);
}

:deep(.sr-centered-header) {
  text-align: center !important;
}

:deep(.sr-centered-header .p-column-header-content) {
  justify-content: center !important;
}

.error-message {
  color: red;
  font-size: 1.5rem;
  margin-top: 1rem;
}

.sr-empty-cell {
  color: #999;
  text-align: center;
  width: 100%;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tab-content .copy-btn {
  align-self: flex-start;
}

.tab-content .json-content {
  background-color: #1e1e1e;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 60vh;
  overflow-y: auto;
  font-size: 0.9rem;
  margin: 0;
}
</style>
