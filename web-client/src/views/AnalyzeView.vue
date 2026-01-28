<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import TwoColumnLayout from '@/layouts/TwoColumnLayout.vue'
import { watch, computed } from 'vue'
import SrAnalyzeOptSidebar from '@/components/SrAnalyzeOptSidebar.vue'
import SrAnalysis from '@/components/SrAnalysis.vue'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { useSrToastStore } from '@/stores/srToastStore'
import { useToast } from 'primevue/usetoast'
import { createLogger } from '@/utils/logger'

const logger = createLogger('AnalyzeView')
const router = useRouter()

const recTreeStore = useRecTreeStore()
const route = useRoute()
const reqId = computed(() => Number(route.params.id) || 0)
const srToastStore = useSrToastStore()
const toast = useToast()

const shouldDisplay = computed(() => {
  return recTreeStore.selectedReqId > 0 && recTreeStore.allReqIds.includes(reqId.value)
})

// Watch for tree data to be loaded, then validate route
watch(
  () => recTreeStore.isTreeLoaded,
  (loaded) => {
    if (!loaded) return

    logger.debug('Tree loaded, validating route', {
      reqId: reqId.value,
      allReqIdsCount: recTreeStore.allReqIds.length
    })

    if (recTreeStore.allReqIds.length > 0) {
      if (recTreeStore.allReqIds.includes(reqId.value)) {
        // Valid route ID - ensure store is synced to it
        //logger.debug('Valid reqId in route, syncing store', { reqId: reqId.value });
        recTreeStore.findAndSelectNode(reqId.value)
      } else if (
        recTreeStore.selectedReqId > 0 &&
        recTreeStore.allReqIds.includes(recTreeStore.selectedReqId)
      ) {
        // Route ID invalid but we have a valid persisted selection - use it
        //logger.debug('Using persisted selectedReqId', { selectedReqId: recTreeStore.selectedReqId });
        void router.replace({
          name: route.name,
          params: { id: recTreeStore.selectedReqId.toString() }
        })
      } else {
        logger.warn('Invalid route ID, resetting to first record', {
          selectedReqId: recTreeStore.selectedReqId,
          allReqIdsCount: recTreeStore.allReqIds.length,
          routeParamsId: route.params.id
        })
        recTreeStore.initToFirstRecord()
        void router.replace({
          name: route.name,
          params: { id: recTreeStore.selectedReqId.toString() }
        })
        toast.add({
          severity: 'warn',
          summary: 'Reset Record Selection',
          detail: `The record specified in the route was INVALID setting to first record`,
          life: srToastStore.getLife()
        })
      }
    } else {
      logger.warn('No records available after tree loaded', { allReqIdsCount: 0 })
    }
  },
  { immediate: true }
)

watch(
  () => route.params.id,
  (newId) => {
    logger.debug('Route ID changed', { newId })
  }
)
</script>

<template>
  <TwoColumnLayout>
    <template v-slot:sidebar-col>
      <SrAnalyzeOptSidebar v-if="shouldDisplay" :startingReqId="reqId" />
    </template>
    <template v-slot:main>
      <SrAnalysis />
    </template>
  </TwoColumnLayout>
</template>

<style scoped>
/* Add any required styles here */
</style>
