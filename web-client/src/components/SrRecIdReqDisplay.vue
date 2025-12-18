<template>
  <div class="sr-rec-req-display-panel">
    <Button
      icon="pi pi-eye"
      :label="props.label"
      class="sr-glow-button"
      @click="openParmsDialog(reqParms)"
      @mouseover="tooltipRef?.showTooltip($event, props.tooltipText)"
      @mouseleave="tooltipRef?.hideTooltip"
      variant="text"
      rounded
      :disabled="props.insensitive"
    ></Button>
    <SrCustomTooltip ref="tooltipRef" id="recIdDisplayTooltip" />
    <SrReqParmsDisplayDlg
      v-model:visible="showParmsDialog"
      :rcvd-parms="reqParms"
      :title="`endpoint = ${curAPI}`"
      :endpoint="curAPI"
      width="80vw"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import Button from 'primevue/button'
import { db } from '@/db/SlideRuleDb'
import SrReqParmsDisplayDlg from './SrReqParmsDisplayDlg.vue'
import SrCustomTooltip from './SrCustomTooltip.vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrRecIdReqDisplay')

const props = withDefaults(
  defineProps<{
    reqId: number
    label: string
    insensitive?: boolean
    tooltipText?: string
  }>(),
  {
    reqId: 0,
    label: 'Show Req Parameters',
    insensitive: false,
    tooltipText: 'click to show request parameters for current record',
    tooltipUrl: '',
    labelFontSize: 'small',
    labelOnRight: false
  }
)

const showParmsDialog = ref(false)
const reqParms = ref<string>('')
const curAPI = ref<string>('')
const tooltipRef = ref()

async function loadReqParams(reqId: number) {
  if (reqId) {
    curAPI.value = await db.getFunc(reqId)
    // Get the full request record to access rcvd_parms
    const request = await db.table('requests').get(reqId)
    // Use rcvd_parms (what server used) if available, fall back to parameters (what was sent)
    const p = request?.rcvd_parms || request?.parameters || {}
    reqParms.value = JSON.stringify(p, null, 2)
  } else {
    logger.debug('loadReqParams: no reqId')
    reqParms.value = ''
    curAPI.value = ''
  }
}

onMounted(() => {
  void loadReqParams(props.reqId)
})

watch(
  () => props.reqId,
  (newReqId) => {
    void loadReqParams(newReqId)
  }
)
// Open the Parms dialog
function openParmsDialog(params: string | object) {
  if (typeof params === 'object') {
    reqParms.value = JSON.stringify(params, null, 2)
  } else {
    reqParms.value = params
  }
  showParmsDialog.value = true
}
</script>

<style scoped>
/* Style your button and component here */
.sr-rec-req-display-panel {
}

.sr-rec-req-display-parms {
  position: relative;
  margin-top: 0rem;
  display: flex;
  justify-content: column;
  max-height: 15rem;
  max-width: 15rem;
  min-height: 10rem;
  overflow-y: auto;
  overflow-x: auto;
  width: 100%;
  text-overflow: clip;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* Internet Explorer 10+ */
}
</style>
