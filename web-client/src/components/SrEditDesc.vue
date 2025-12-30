<script setup lang="ts">
import { db } from '@/db/SlideRuleDb'
import { ref, watch, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import FloatLabel from 'primevue/floatlabel'
import { useSrToastStore } from '@/stores/srToastStore'
import { getCenter, calculateBounds } from '@/utils/geoUtils'
import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
import { createLogger } from '@/utils/logger'
import { useGeoCoderStore } from '@/stores/geoCoderStore'

const logger = createLogger('SrEditDesc')
const geoCoderStore = useGeoCoderStore()

// Define props first
const props = defineProps({
  reqId: {
    type: Number,
    default: 0
  },
  label: {
    type: String,
    default: 'Description'
  }
})

const descrRef = ref('')
const tooltipRef = ref()

// Watch for changes in the reqId and fetch the description asynchronously
const fetchDescription = async () => {
  //console.log('fetchDescription called with reqId:', props.reqId);
  if (props.reqId > 0) {
    descrRef.value = await db.getDescription(props.reqId)
    //console.log('fetchDescription called with reqId:', props.reqId,'descrRef.value:', descrRef.value);
    if (!descrRef.value) {
      try {
        const poly = await db.getSvrReqPoly(props.reqId)

        // Check if poly is valid array with data
        // getSvrReqPoly returns {} as SrRegion when svr_parms doesn't have polygon data
        const isValidPoly = poly && Array.isArray(poly) && poly.length > 0

        if (isValidPoly) {
          const bounds = calculateBounds(poly)
          if (!bounds) {
            logger.warn('fetchDescription Failed to calculate bounds from polygon', {
              reqId: props.reqId
            })
            descrRef.value = 'Location data unavailable'
            return
          }

          const c = getCenter(bounds)
          const result = await geoCoderStore.reverseGeocode(c.lat, c.lon)
          descrRef.value = result.displayName
          void db.updateRequest(props.reqId, { description: descrRef.value })
        } else {
          // No valid polygon found in svr_parms
          logger.warn('fetchDescription No valid polygon in svr_parms', {
            reqId: props.reqId,
            polyType: typeof poly,
            isArray: Array.isArray(poly),
            polyLength: Array.isArray(poly) ? poly.length : 'N/A'
          })
          descrRef.value = 'Location data not available'
        }
      } catch (error) {
        // Error accessing svr_parms or request record
        const request = await db.getRequest(props.reqId)
        const isSuccess = request?.status === 'success'

        if (isSuccess) {
          logger.error('fetchDescription Error getting svr_parms polygon', {
            reqId: props.reqId,
            status: request?.status,
            error: error instanceof Error ? error.message : String(error)
          })
        } else {
          logger.warn('fetchDescription Error getting svr_parms polygon', {
            reqId: props.reqId,
            status: request?.status,
            error: error instanceof Error ? error.message : String(error)
          })
        }
        descrRef.value = 'Unable to determine location'
      }
    } else {
      //console.log('fetchDescription Description:', descrRef.value);
      // Update the store with the fetched description
    }
  } else {
    descrRef.value = `fetchDescription No description available for props:${props.reqId}`
  }
  //console.log('fetchDescription FINAL Description:', descrRef.value);
}

onMounted(fetchDescription)

// Also, watch for changes in the `reqId` prop to re-fetch the description if needed
watch(() => props.reqId, fetchDescription)
const showTooltip = (event: MouseEvent) => {
  tooltipRef.value?.showTooltip(event, descrRef.value)
}

const hideTooltip = () => {
  tooltipRef.value?.hideTooltip()
}

const onEditComplete = async (event: Event) => {
  const inputElement = event.target as HTMLInputElement
  const newValue = inputElement.value.trim()
  descrRef.value = newValue // Update the specific field with the new value
  await db.updateRequestRecord({ req_id: props.reqId, description: descrRef.value }, false)
  useSrToastStore().info('Description Updated', 'You updated the description', 2000)
  //console.log('Edit completed, new value:', newValue, 'Description:', descrRef.value);
}
</script>
<template>
  <FloatLabel class="full-width-label">
    <SrCustomTooltip ref="tooltipRef" id="editDecrTooltip" />
    <InputText
      v-if="props.reqId > 0"
      v-model="descrRef"
      class="p-inputtext p-component"
      @keydown.enter="onEditComplete"
      @blur="onEditComplete"
      @mouseover="showTooltip"
      @mouseleave="hideTooltip"
    />
    <label v-if="props.label != ''">{{ label }}</label>
  </FloatLabel>
</template>

<style scoped>
.full-width-label {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.p-inputtext {
  width: 100%;
  text-align: center;
}

label {
  width: 100%;
  text-align: center;
  display: block;
}
</style>

<style scoped></style>
