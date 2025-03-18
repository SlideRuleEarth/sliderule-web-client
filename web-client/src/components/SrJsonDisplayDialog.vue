<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import Dialog  from 'primevue/dialog'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/atom-one-dark.css'

hljs.registerLanguage('json', json)

const props = defineProps<{
  jsonData: object | string | null
  width?: string,
  title?: string
}>()

const modelValue = defineModel<boolean>({ default: false })
const jsonBlock = ref<HTMLElement | null>(null)

const prettyJson = computed(() => {
  try {
    const jsonObj = typeof props.jsonData === 'string' 
      ? JSON.parse(props.jsonData) 
      : props.jsonData
    return JSON.stringify(jsonObj, null, 2)
  } catch (e) {
    return 'Invalid JSON'
  }
})
const highlightedJson = computed(() => {
  const result = hljs.highlight(prettyJson.value, { language: 'json' })
  return result.value
})

// Highlight JSON when dialog opens or data changes
const highlightJson = () => {
  if (jsonBlock.value) {
    hljs.highlightElement(jsonBlock.value)
  }
}

watch([modelValue, prettyJson], () => {
  if (modelValue.value) {
    nextTick(() => highlightJson())
  }
})

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
            <div class="dialog-title">{{ props.title || 'JSON Data' }}</div>
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
.json-display {
  background-color: #1e1e1e;
  color: #dcdcdc;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  max-height: 60vh;
  line-height: 1.4;
  border: 1px solid #333;
}
.dialog-title {
  width: 100%;
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
}


</style>
