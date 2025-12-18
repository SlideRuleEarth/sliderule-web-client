<template>
  <div class="sr-req-display-panel">
    <SrCustomTooltip ref="tooltipRef" id="recDisplayTooltip" />
    <Button
      icon="pi pi-eye"
      :label="props.label"
      class="sr-glow-button"
      id="sr-req-display-btn"
      @click="openParmsDialog()"
      @mouseover="tooltipRef?.showTooltip($event, props.tooltipText)"
      @mouseleave="tooltipRef?.hideTooltip"
      variant="text"
      rounded
    ></Button>
    <SrReqParmsDisplayDlg
      v-model:visible="showParmsDialog"
      :json-data="reqParms"
      :title="`endpoint = ${curAPI}`"
      :endpoint="curAPI"
      width="80vw"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useAutoReqParamsStore } from '@/stores/reqParamsStore'
import SrReqParmsDisplayDlg from './SrReqParmsDisplayDlg.vue'
import SrCustomTooltip from './SrCustomTooltip.vue'
import Button from 'primevue/button'
import { useRecTreeStore } from '@/stores/recTreeStore'

// Props
const props = defineProps({
  label: {
    type: String,
    default: 'Show Request Parameters'
  },
  isForPhotonCloud: {
    type: Boolean,
    default: false
  },
  tooltipText: {
    type: String,
    default: 'Show or hide the request parameters'
  }
})
const tooltipRef = ref()
const showParmsDialog = ref(false)
const recTreeStore = useRecTreeStore()
const reqParamsStore = props.isForPhotonCloud ? useAutoReqParamsStore() : useReqParamsStore()
const curAPI = computed(() => (reqParamsStore ? reqParamsStore.getCurAPIStr() : ''))
const reqParms = computed(() => {
  return reqParamsStore.getAtlxxReqParams(0)
})
// Open the Parms dialog
async function openParmsDialog() {
  if (props.isForPhotonCloud) {
    await reqParamsStore.presetForScatterPlotOverlay(recTreeStore.selectedReqId)
  }
  //console.log("Opening parms dialog with reqParms:", JSON.stringify(reqParms.value, null, 2));
  showParmsDialog.value = true
}

onMounted(() => {
  //console.log("SrReqDisplay mounted with isForPhotonCloud:", props.isForPhotonCloud, " reqParams:", JSON.stringify(reqParms.value, null, 2));
})
</script>

<style scoped>
.sr-req-display-panel {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0;
}
</style>
