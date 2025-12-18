<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import lua from 'highlight.js/lib/languages/lua'
import 'highlight.js/styles/atom-one-dark.css'
import { createLogger } from '@/utils/logger'
import {
  jsonToPythonDict,
  generatePythonClientCode,
  jsonToLuaTable,
  downloadAsFile
} from '@/utils/reqParmsConverters'

const logger = createLogger('SrReqParmsDisplayDlg')

// Register all languages
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)
hljs.registerLanguage('lua', lua)

const props = defineProps<{
  jsonData: object | string | null
  width?: string
  title?: string
  endpoint?: string
}>()

const modelValue = defineModel<boolean>({ default: false })
const activeTab = ref('0')

// Parse JSON data to object
const parsedData = computed(() => {
  try {
    if (!props.jsonData || (typeof props.jsonData === 'string' && props.jsonData.trim() === '')) {
      return null
    }
    if (typeof props.jsonData === 'object' && Object.keys(props.jsonData).length === 0) {
      return null
    }
    return typeof props.jsonData === 'string' ? JSON.parse(props.jsonData) : props.jsonData
  } catch (error) {
    logger.warn('Failed to parse JSON data', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
})

// Extract inner data (remove 'parms' wrapper if present) for JSON/Python Snippet/Lua tabs
const innerData = computed(() => {
  if (!parsedData.value) return null
  // If the data has a 'parms' key, extract just that level
  if (parsedData.value.parms && typeof parsedData.value.parms === 'object') {
    return parsedData.value.parms
  }
  return parsedData.value
})

// JSON format (uses innerData - without parms wrapper)
const prettyJson = computed(() => {
  if (!innerData.value) return 'No data available'
  try {
    return JSON.stringify(innerData.value, null, 2)
  } catch {
    return 'Invalid JSON format'
  }
})

const highlightedJson = computed(() => {
  try {
    return hljs.highlight(prettyJson.value, { language: 'json' }).value
  } catch {
    return prettyJson.value
  }
})

// Python snippet (dict literal only - uses innerData without parms wrapper)
const pythonSnippet = computed(() => {
  if (!innerData.value) return '# No data available'
  try {
    return jsonToPythonDict(innerData.value)
  } catch {
    return '# Error converting to Python'
  }
})

const highlightedPythonSnippet = computed(() => {
  try {
    return hljs.highlight(pythonSnippet.value, { language: 'python' }).value
  } catch {
    return pythonSnippet.value
  }
})

// Python complete example (uses innerData - without parms wrapper)
const pythonExample = computed(() => {
  if (!innerData.value) return '# No data available'
  try {
    return generatePythonClientCode(innerData.value, props.endpoint || 'atl06p')
  } catch {
    return '# Error generating Python code'
  }
})

const highlightedPythonExample = computed(() => {
  try {
    return hljs.highlight(pythonExample.value, { language: 'python' }).value
  } catch {
    return pythonExample.value
  }
})

// Lua format (uses innerData - without parms wrapper)
const luaCode = computed(() => {
  if (!innerData.value) return '-- No data available'
  try {
    return jsonToLuaTable(innerData.value)
  } catch {
    return '-- Error converting to Lua'
  }
})

const highlightedLua = computed(() => {
  try {
    return hljs.highlight(luaCode.value, { language: 'lua' }).value
  } catch {
    return luaCode.value
  }
})

// Copy functions
const copyJsonToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(prettyJson.value)
    logger.debug('Copied JSON to clipboard')
  } catch (err) {
    logger.error('Failed to copy JSON', { error: err instanceof Error ? err.message : String(err) })
  }
}

const copyPythonSnippetToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(pythonSnippet.value)
    logger.debug('Copied Python snippet to clipboard')
  } catch (err) {
    logger.error('Failed to copy Python snippet', {
      error: err instanceof Error ? err.message : String(err)
    })
  }
}

const copyPythonExampleToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(pythonExample.value)
    logger.debug('Copied Python example to clipboard')
  } catch (err) {
    logger.error('Failed to copy Python example', {
      error: err instanceof Error ? err.message : String(err)
    })
  }
}

const copyLuaToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(luaCode.value)
    logger.debug('Copied Lua to clipboard')
  } catch (err) {
    logger.error('Failed to copy Lua', { error: err instanceof Error ? err.message : String(err) })
  }
}

// Export Python example as file
const exportPythonExample = () => {
  const endpoint = props.endpoint || 'sliderule'
  const filename = `${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}_request.py`
  downloadAsFile(pythonExample.value, filename)
  logger.debug('Exported Python example', { filename })
}

// Re-highlight when dialog opens
watch([modelValue, parsedData], () => {
  if (modelValue.value) {
    void nextTick()
  }
})
</script>

<template>
  <Dialog
    v-model:visible="modelValue"
    :modal="true"
    :closable="true"
    :style="{ width: width || '80vw' }"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-title">{{ props.title || 'Request Parameters' }}</div>
      </div>
    </template>

    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="0">JSON</Tab>
        <Tab value="1">Python Snippet</Tab>
        <Tab value="2">Lua</Tab>
        <Tab value="3">Python Example</Tab>
      </TabList>

      <TabPanels>
        <!-- JSON Tab -->
        <TabPanel value="0">
          <div class="tab-content">
            <div class="button-row">
              <Button
                label="Copy JSON"
                size="small"
                icon="pi pi-copy"
                @click="copyJsonToClipboard"
              />
            </div>
            <pre v-html="highlightedJson"></pre>
          </div>
        </TabPanel>

        <!-- Python Snippet Tab -->
        <TabPanel value="1">
          <div class="tab-content">
            <div class="button-row">
              <Button
                label="Copy Snippet"
                size="small"
                icon="pi pi-copy"
                @click="copyPythonSnippetToClipboard"
              />
            </div>
            <pre v-html="highlightedPythonSnippet"></pre>
          </div>
        </TabPanel>

        <!-- Lua Tab -->
        <TabPanel value="2">
          <div class="tab-content">
            <div class="button-row">
              <Button label="Copy Lua" size="small" icon="pi pi-copy" @click="copyLuaToClipboard" />
            </div>
            <pre v-html="highlightedLua"></pre>
          </div>
        </TabPanel>

        <!-- Python Example Tab -->
        <TabPanel value="3">
          <div class="tab-content">
            <div class="button-row">
              <Button
                label="Copy Code"
                size="small"
                icon="pi pi-copy"
                @click="copyPythonExampleToClipboard"
              />
              <Button
                label="Export as .py"
                size="small"
                icon="pi pi-download"
                @click="exportPythonExample"
                severity="secondary"
              />
            </div>
            <pre v-html="highlightedPythonExample"></pre>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>

<style scoped>
pre {
  background-color: #1e1e1e;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.9rem;
  max-height: 60vh;
  overflow-y: auto;
  margin: 0;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.dialog-title {
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.button-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
