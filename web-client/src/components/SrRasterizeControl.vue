<template>
  <!-- Wrapper that OL will style; global CSS targets .sr-control -->
  <div
    ref="containerEl"
    class="ol-control ol-unselectable sr-control sr-rasterize-control"
    role="group"
    aria-label="Rasterize control"
    :style="varStyle"
  >
    <SrRasterize
      ref="rasterize"
      :disabled="mapStore.polygonSource !== 'Draw on Map'"
      @rasterize-changed="handleRasterizeChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import Control from 'ol/control/Control'
import SrRasterize from './SrRasterize.vue'
import { useMapStore } from '@/stores/mapStore'

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const props = defineProps({
  /** Which corner to pin to */
  corner: { type: String as () => Corner, default: 'top-left' },

  /** Offsets from the chosen corner. Number => px; String => raw CSS (e.g. '0.5rem') */
  offsetX: { type: [Number, String], default: '0.5rem' },
  offsetY: { type: [Number, String], default: '25rem' },

  /** Style knobs (optional) */
  bg: { type: String, default: 'black' },
  color: { type: String, default: 'var(--ol-font-color)' },
  radius: { type: String, default: 'var(--p-border-radius)' },
  zIndex: { type: [Number, String], default: undefined }
})

const mapStore = useMapStore()

const emit = defineEmits<{
  /** Parent (SrMap.vue) listens and calls map.addControl(control) */
  (_e: 'rasterize-control-created', _control: Control): void
  /** Emitted when rasterize checkbox state changes */
  (_e: 'rasterize-changed', _enabled: boolean): void
}>()

const toCss = (v: number | string) => (typeof v === 'number' ? `${v}px` : v)

function handleRasterizeChanged(enabled: boolean) {
  emit('rasterize-changed', enabled)
}

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
const rasterize = ref<InstanceType<typeof SrRasterize> | null>(null)
let control: Control | null = null

onMounted(() => {
  if (!containerEl.value) return
  control = new Control({ element: containerEl.value })
  emit('rasterize-control-created', control)
})

onBeforeUnmount(() => {
  control?.setMap?.(null)
  control = null
})

defineExpose({
  reset() {
    rasterize.value?.reset()
  }
})
</script>

<style scoped>
.sr-rasterize-control {
  position: absolute;
  top: var(--sr-top, auto);
  right: var(--sr-right, auto);
  bottom: var(--sr-bottom, auto);
  left: var(--sr-left, auto);
  background: var(--sr-bg, transparent);
  color: var(--p-text-color);
  border-radius: var(--sr-radius, 4px);
  padding: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
