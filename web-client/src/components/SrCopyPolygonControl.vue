<template>
  <div
    ref="containerEl"
    class="ol-control ol-unselectable sr-control sr-copy-polygon-control"
    role="group"
    aria-label="Copy Polygon control"
    :style="varStyle"
  >
    <Button
      :icon="copied ? 'pi pi-check' : 'pi pi-clipboard'"
      class="p-button-icon-only sr-copy-polygon-button"
      @click="copyToClipboard"
      variant="text"
      :disabled="!hasPolygon"
      aria-label="Copy polygon region to clipboard"
      :title="tooltipText"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import Control from 'ol/control/Control'
import Button from 'primevue/button'
import { useHelperMapStore } from '@/stores/helperMapStore'
import { useSrToastStore } from '@/stores/srToastStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrCopyPolygonControl')

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const props = defineProps({
  /** Which corner to pin to */
  corner: { type: String as () => Corner, default: 'top-left' },
  offsetX: { type: [Number, String], default: '0.5rem' },
  offsetY: { type: [Number, String], default: '20.5rem' },
  bg: { type: String, default: 'rgba(0, 0, 0, 0.8)' },
  color: { type: String, default: 'white' },
  radius: { type: String, default: 'var(--p-border-radius)' },
  zIndex: { type: [Number, String], default: undefined }
})

const emit = defineEmits<{
  (_e: 'copy-polygon-control-created', _control: Control): void
}>()

const helperMapStore = useHelperMapStore()
const toastStore = useSrToastStore()
const copied = ref(false)

const hasPolygon = computed(() => {
  return helperMapStore.poly && helperMapStore.poly.length > 0
})

const tooltipText = 'Copy polygon region to clipboard (for AI agent API requests)'

async function copyToClipboard() {
  try {
    const text = helperMapStore.getPolygonForClipboard()

    if (!text) {
      toastStore.warn('No Polygon', 'Please draw a polygon on the map first')
      return
    }

    await navigator.clipboard.writeText(text)
    helperMapStore.copiedToClipboard = true
    copied.value = true

    toastStore.info(
      'Copied to Clipboard',
      'Polygon region copied — paste it into your AI agent prompt'
    )

    // Reset the check icon after 2 seconds
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    logger.error('Error copying to clipboard', {
      error: error instanceof Error ? error.message : String(error)
    })
    toastStore.error('Copy Failed', 'Failed to copy polygon to clipboard')
  }
}

const toCss = (v: number | string) => (typeof v === 'number' ? `${v}px` : v)

const varStyle = computed(() => {
  const x = toCss(props.offsetX)
  const y = toCss(props.offsetY)
  const top = props.corner.startsWith('top') ? y : 'auto'
  const bottom = props.corner.startsWith('bottom') ? y : 'auto'
  const left = props.corner.endsWith('left') ? x : 'auto'
  const right = props.corner.endsWith('right') ? x : 'auto'

  return {
    '--sr-top': top,
    '--sr-right': right,
    '--sr-bottom': bottom,
    '--sr-left': left,
    '--sr-bg': props.bg,
    '--sr-color': props.color,
    '--sr-radius': props.radius,
    ...(props.zIndex != null ? { zIndex: String(props.zIndex) } : {})
  } as Record<string, string>
})

const containerEl = ref<HTMLDivElement | null>(null)
let control: Control | null = null

onMounted(() => {
  if (!containerEl.value) return
  control = new Control({ element: containerEl.value })
  emit('copy-polygon-control-created', control)
})

onBeforeUnmount(() => {
  control?.setMap?.(null)
  control = null
})
</script>

<style scoped>
.sr-copy-polygon-button.p-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.25rem;
  background: var(--sr-bg);
  color: var(--sr-color);
  border-radius: var(--sr-radius);
}

.sr-copy-polygon-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.sr-copy-polygon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sr-copy-polygon-control {
  position: absolute;
  top: var(--sr-top);
  right: var(--sr-right);
  bottom: var(--sr-bottom);
  left: var(--sr-left);
  background: transparent;
  padding: 0;
}
</style>
