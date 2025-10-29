<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/atom-one-dark.css'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrJsonDisplayDialog')

hljs.registerLanguage('json', json)

const props = defineProps<{
  jsonData: object | string | null
  width?: string
  title?: string
}>()

const modelValue = defineModel<boolean>({ default: false })
const jsonBlock = ref<HTMLElement | null>(null)

const prettyJson = computed(() => {
  try {
    // Handle null, undefined, or empty string
    if (!props.jsonData || (typeof props.jsonData === 'string' && props.jsonData.trim() === '')) {
      return 'No data available'
    }

    // Handle empty object
    if (typeof props.jsonData === 'object' && Object.keys(props.jsonData).length === 0) {
      return 'No data available'
    }

    const jsonObj = typeof props.jsonData === 'string' ? JSON.parse(props.jsonData) : props.jsonData
    return JSON.stringify(jsonObj, null, 2)
  } catch (error) {
    logger.warn('Failed to parse JSON data', {
      error: error instanceof Error ? error.message : String(error),
      dataType: typeof props.jsonData
    })
    return 'Invalid JSON format'
  }
})

const highlightedJson = computed(() => {
  try {
    const result = hljs.highlight(prettyJson.value, { language: 'json' })
    return result.value
  } catch (error) {
    logger.warn('Failed to highlight JSON', {
      error: error instanceof Error ? error.message : String(error)
    })
    // Return plain text if highlighting fails
    return prettyJson.value
  }
})

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(prettyJson.value)
    logger.debug('Copied to clipboard')
  } catch (err) {
    logger.error('Failed to copy', { error: err instanceof Error ? err.message : String(err) })
  }
}

watch([modelValue, prettyJson], () => {
  if (modelValue.value) {
    void nextTick(() => highlightJson())
  }
})

const highlightJson = () => {
  if (jsonBlock.value) {
    hljs.highlightElement(jsonBlock.value)
  }
}

onMounted(() => {
  if (modelValue.value) highlightJson()
})
</script>

<template>
  <Dialog
    v-model:visible="modelValue"
    :modal="true"
    :closable="true"
    :style="{ width: width || '50vw' }"
  >
    <template #header>
      <div class="dialog-header">
        <Button
          label="Copy to clipboard"
          size="small"
          icon="pi pi-copy"
          @click="copyToClipboard"
          class="copy-btn"
        />
        <div class="dialog-title">{{ props.title || 'JSON Data' }}</div>
      </div>
    </template>

    <pre v-html="highlightedJson"></pre>
  </Dialog>
</template>

<style scoped>
pre {
  background-color: #1e1e1e;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.9rem;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem; /* optional spacing */
}

.copy-btn {
  flex-shrink: 0; /* prevents the button from shrinking */
}

.dialog-title {
  flex: 1;
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
}
</style>
