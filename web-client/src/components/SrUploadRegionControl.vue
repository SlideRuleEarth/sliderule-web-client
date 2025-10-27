<!-- SrUploadRegionControl.vue -->
<template>
  <!-- Wrapper that OL will style; global CSS targets .sr-control -->
  <div
    ref="containerEl"
    class="ol-control ol-unselectable sr-control sr-upload-region-control"
    role="group"
    aria-label="Upload Region control"
    :style="varStyle"
  >
    <SrUploadRegion :reportUploadProgress="reportUploadProgress" :loadReqPoly="loadReqPoly" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import Control from 'ol/control/Control'
import SrUploadRegion from '@/components/SrUploadRegion.vue'

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const props = defineProps({
  reportUploadProgress: { type: Boolean, default: false },
  loadReqPoly: { type: Boolean, default: false },

  /** Which corner to pin to */
  corner: { type: String as () => Corner, default: 'top-left' },

  /** Offsets from the chosen corner. Number => px; String => raw CSS (e.g. '0.5rem') */
  offsetX: { type: [Number, String], default: '0.5rem' },
  offsetY: { type: [Number, String], default: '19rem' },

  /** Style knobs (optional) */
  bg: { type: String, default: 'black' },
  color: { type: String, default: 'var(--ol-font-color)' },
  radius: { type: String, default: 'var(--p-border-radius)' },
  zIndex: { type: [Number, String], default: undefined }
})

const emit = defineEmits<{
  /** Parent (SrMap.vue) listens and calls map.addControl(control) */
  (_e: 'upload-region-control-created', _control: Control): void
}>()

const toCss = (v: number | string) => (typeof v === 'number' ? `${v}px` : v)

const varStyle = computed(() => {
  const x = toCss(props.offsetX)
  const y = toCss(props.offsetY)
  const top = props.corner.startsWith('top') ? y : 'auto'
  const bottom = props.corner.startsWith('bottom') ? y : 'auto'
  const left = props.corner.endsWith('left') ? x : 'auto'
  const right = props.corner.endsWith('right') ? x : 'auto'

  return {
    // Placement via CSS vars:
    '--sr-top': top,
    '--sr-right': right,
    '--sr-bottom': bottom,
    '--sr-left': left,

    // Styling via CSS vars:
    '--sr-bg': props.bg,
    '--sr-color': props.color,
    '--sr-radius': props.radius,

    // Extra (non-var) styling:
    ...(props.zIndex != null ? { zIndex: String(props.zIndex) } : {})
  } as Record<string, string>
})

const containerEl = ref<HTMLDivElement | null>(null)
let control: Control | null = null

onMounted(() => {
  if (!containerEl.value) return
  control = new Control({ element: containerEl.value })
  emit('upload-region-control-created', control)
})

onBeforeUnmount(() => {
  control?.setMap?.(null)
  control = null
})
</script>
