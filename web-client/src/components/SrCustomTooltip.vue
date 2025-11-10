<template>
  <Teleport to="body">
    <div class="tooltip" :id="props.id" v-if="visible" :style="tooltipStyle" v-html="text"></div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { Teleport as _Teleport } from 'vue'
import DOMPurify from 'dompurify'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrCustomTooltip')

const props = defineProps<{ id: string }>()

const visible = ref(false)
const text = ref('')
const tooltipStyle = ref<Record<string, string>>({})

const plainText = ref('')

const showTooltip = async (event: MouseEvent, content: string | undefined, recordId?: string) => {
  if (!content) {
    logger.warn('Tooltip content is undefined or empty')
    return
  }

  // Sanitize HTML content
  let sanitized = DOMPurify.sanitize(content)

  // Prepend record ID if provided
  if (recordId) {
    sanitized = `<strong>Record ID</strong>: <em>${recordId}</em><br>${sanitized}`
  }

  text.value = sanitized
  logger.warn('Tooltip HTML content set:', sanitized)
  // Store plain text version with proper newlines
  // Replace HTML line breaks and block elements with newlines before stripping tags
  let textWithNewlines = sanitized
    .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newline
    .replace(/<\/p>/gi, '\n\n') // Convert </p> to double newline
    .replace(/<\/div>/gi, '\n') // Convert </div> to newline
    .replace(/<\/li>/gi, '\n') // Convert </li> to newline
    .replace(/<\/h[1-6]>/gi, '\n\n') // Convert </h1-6> to double newline
    .replace(/<strong>(.*?)<\/strong>/gi, '$1') // Remove <strong> but keep text
    .replace(/<em>(.*?)<\/em>/gi, '$1') // Remove <em> but keep text
  logger.warn('Tooltip plain text with newlines:', textWithNewlines)
  // Create a temporary element to strip remaining HTML tags
  const temp = document.createElement('div')
  temp.innerHTML = textWithNewlines
  plainText.value = (temp.textContent || temp.innerText || '').trim()

  visible.value = true

  await nextTick() // Ensure tooltip is rendered

  const tooltipEl = document.getElementById(props.id) as HTMLElement | null
  const tooltipRect = tooltipEl?.getBoundingClientRect()
  const { clientX: x, clientY: y } = event
  const tooltipOffset = 10

  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight

  let left = x + tooltipOffset
  let top = y + tooltipOffset

  if (tooltipRect) {
    if (left + tooltipRect.width > windowWidth) {
      left = x - tooltipRect.width - tooltipOffset
    }
    if (top + tooltipRect.height > windowHeight) {
      top = y - tooltipRect.height - tooltipOffset
    }
  }

  tooltipStyle.value = {
    top: `${Math.max(0, top)}px`,
    left: `${Math.max(0, left)}px`
  }
  //console.log('x:',x,'y',y,'Tooltip style:', tooltipStyle.value,'Tooltip element:', tooltipEl, 'Rect:', tooltipRect);
}

const hideTooltip = () => {
  visible.value = false
}

const getPlainText = () => {
  return plainText.value
}

defineExpose({
  showTooltip,
  hideTooltip,
  getPlainText
})
</script>

<style scoped>
.tooltip {
  position: absolute;
  background-color: #333;
  color: #fff;
  padding: 5px 8px;
  border-radius: 4px;
  z-index: 1000;
  max-width: 15rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  pointer-events: none;
  white-space: normal;
  word-break: break-word;
}
</style>
