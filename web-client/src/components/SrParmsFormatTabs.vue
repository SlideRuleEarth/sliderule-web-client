<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
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
import DOMPurify from 'dompurify'
import { createLogger } from '@/utils/logger'
import {
  jsonToPythonDict,
  generatePythonClientCode,
  jsonToLuaTable,
  downloadAsFile,
  cleanParamsForPythonClient
} from '@/utils/reqParmsConverters'

const logger = createLogger('SrParmsFormatTabs')

// Register all languages
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)
hljs.registerLanguage('lua', lua)

const props = withDefaults(
  defineProps<{
    rcvdParms: object | string | null
    sentParms?: object | string | null
    endpoint?: string
    mode?: 'received' | 'sending'
  }>(),
  {
    mode: 'received'
  }
)

// Tooltip text based on mode
const tooltipPrefix = computed(() =>
  props.mode === 'sending'
    ? 'Request parameters that will be sent to server formatted in'
    : 'Request parameters used by the server to create this record formatted in'
)

const activeTab = ref('0')

// Parse rcvdParms to object (this is the primary data source when available)
const parsedRcvdParms = computed(() => {
  try {
    if (
      !props.rcvdParms ||
      (typeof props.rcvdParms === 'string' && props.rcvdParms.trim() === '')
    ) {
      return null
    }
    if (typeof props.rcvdParms === 'object' && Object.keys(props.rcvdParms).length === 0) {
      return null
    }
    const parsed =
      typeof props.rcvdParms === 'string' ? JSON.parse(props.rcvdParms) : props.rcvdParms
    // Extract inner parms if wrapped (same as sentParms handling)
    // Also preserve top-level fields like 'resources' alongside parms content
    if (parsed?.parms && typeof parsed.parms === 'object' && !Array.isArray(parsed.parms)) {
      const result = { ...parsed.parms }
      if (parsed.resources && Array.isArray(parsed.resources) && parsed.resources.length > 0) {
        result.resources = parsed.resources
      }
      return result
    }
    return parsed
  } catch (error) {
    logger.warn('Failed to parse rcvdParms data', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
})

// Parse sentParms to object
const parsedSentParms = computed(() => {
  try {
    if (
      !props.sentParms ||
      (typeof props.sentParms === 'string' && props.sentParms.trim() === '')
    ) {
      return null
    }
    if (typeof props.sentParms === 'object' && Object.keys(props.sentParms).length === 0) {
      return null
    }
    const parsed =
      typeof props.sentParms === 'string' ? JSON.parse(props.sentParms) : props.sentParms
    // Extract inner parms if wrapped
    if (parsed?.parms && typeof parsed.parms === 'object' && !Array.isArray(parsed.parms)) {
      return parsed.parms
    }
    return parsed
  } catch (error) {
    logger.warn('Failed to parse sentParms data', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
})

// parsedData falls back to sentParms when rcvdParms is not available (e.g., on request error)
const parsedData = computed(() => {
  if (parsedRcvdParms.value) {
    return parsedRcvdParms.value
  }
  // Fallback to sent params when received params are not available
  return parsedSentParms.value
})

// Fields that should be objects but server may return as empty arrays
const OBJECT_FIELDS = ['fit', 'phoreal', 'atl24', 'atl13', 'yapc', 'output', 'cmr']

// Normalize server response: convert empty arrays to empty objects for known object fields
function normalizeServerParams(data: any): any {
  if (!data || typeof data !== 'object') return data
  const result = { ...data }
  for (const field of OBJECT_FIELDS) {
    if (Array.isArray(result[field]) && result[field].length === 0) {
      result[field] = {}
    }
  }
  return result
}

// Extract inner data (remove 'parms' wrapper if present) for JSON/Python Snippet/Lua tabs
// In 'sending' mode, preserve the wrapper for consistency with the editable request format
const innerData = computed(() => {
  if (!parsedData.value) return null
  // In sending mode, preserve the full structure including parms wrapper
  if (props.mode === 'sending') {
    return normalizeServerParams(parsedData.value)
  }
  // If the data has a 'parms' key, extract just that level
  if (parsedData.value.parms && typeof parsedData.value.parms === 'object') {
    return normalizeServerParams(parsedData.value.parms)
  }
  return normalizeServerParams(parsedData.value)
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
    return DOMPurify.sanitize(hljs.highlight(prettyJson.value, { language: 'json' }).value)
  } catch {
    return DOMPurify.sanitize(prettyJson.value)
  }
})

// Sent params JSON format (for the Sent tab)
const prettySentJson = computed(() => {
  if (!parsedSentParms.value) return 'No data available'
  try {
    return JSON.stringify(parsedSentParms.value, null, 2)
  } catch {
    return 'Invalid JSON format'
  }
})

const highlightedSentJson = computed(() => {
  try {
    return DOMPurify.sanitize(hljs.highlight(prettySentJson.value, { language: 'json' }).value)
  } catch {
    return DOMPurify.sanitize(prettySentJson.value)
  }
})

// Python snippet (dict literal only - uses innerData without parms wrapper)
// Cleaned for Python client usage (removes 'output' field and duplicate 'poly' in nested objects)
const pythonSnippet = computed(() => {
  if (!innerData.value) return '# No data available'
  try {
    return jsonToPythonDict(cleanParamsForPythonClient(innerData.value))
  } catch {
    return '# Error converting to Python'
  }
})

const highlightedPythonSnippet = computed(() => {
  try {
    return DOMPurify.sanitize(hljs.highlight(pythonSnippet.value, { language: 'python' }).value)
  } catch {
    return DOMPurify.sanitize(pythonSnippet.value)
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
    return DOMPurify.sanitize(hljs.highlight(pythonExample.value, { language: 'python' }).value)
  } catch {
    return DOMPurify.sanitize(pythonExample.value)
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
    return DOMPurify.sanitize(hljs.highlight(luaCode.value, { language: 'lua' }).value)
  } catch {
    return DOMPurify.sanitize(luaCode.value)
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

const copySentJsonToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(prettySentJson.value)
    logger.debug('Copied sent JSON to clipboard')
  } catch (err) {
    logger.error('Failed to copy sent JSON', {
      error: err instanceof Error ? err.message : String(err)
    })
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

// Logical diff between sent and received params
type DiffEntry = {
  path: string
  type: 'added' | 'removed' | 'changed'
  oldValue?: any
  newValue?: any
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    // Sort arrays for comparison if they contain primitives
    const sortedA = [...a].sort()
    const sortedB = [...b].sort()
    return sortedA.every((val, i) => deepEqual(val, sortedB[i]))
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every((key) => deepEqual(a[key], b[key]))
  }

  return false
}

function computeDiff(sent: any, received: any, path: string = ''): DiffEntry[] {
  const diffs: DiffEntry[] = []

  if (sent === null || sent === undefined) {
    if (received !== null && received !== undefined) {
      if (typeof received === 'object' && !Array.isArray(received)) {
        // Recurse into received object to show all added keys
        for (const key of Object.keys(received)) {
          const newPath = path ? `${path}.${key}` : key
          diffs.push({ path: newPath, type: 'added', newValue: received[key] })
        }
      } else {
        diffs.push({ path: path || '(root)', type: 'added', newValue: received })
      }
    }
    return diffs
  }

  if (received === null || received === undefined) {
    if (typeof sent === 'object' && !Array.isArray(sent)) {
      for (const key of Object.keys(sent)) {
        const newPath = path ? `${path}.${key}` : key
        diffs.push({ path: newPath, type: 'removed', oldValue: sent[key] })
      }
    } else {
      diffs.push({ path: path || '(root)', type: 'removed', oldValue: sent })
    }
    return diffs
  }

  // Both are objects
  if (
    typeof sent === 'object' &&
    typeof received === 'object' &&
    !Array.isArray(sent) &&
    !Array.isArray(received)
  ) {
    const allKeys = new Set([...Object.keys(sent), ...Object.keys(received)])

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key
      const sentHas = key in sent
      const receivedHas = key in received

      if (sentHas && !receivedHas) {
        diffs.push({ path: newPath, type: 'removed', oldValue: sent[key] })
      } else if (!sentHas && receivedHas) {
        diffs.push({ path: newPath, type: 'added', newValue: received[key] })
      } else {
        // Both have the key - recurse or compare
        diffs.push(...computeDiff(sent[key], received[key], newPath))
      }
    }
  } else if (!deepEqual(sent, received)) {
    // Primitive or array changed
    diffs.push({ path: path || '(root)', type: 'changed', oldValue: sent, newValue: received })
  }

  return diffs
}

// Only show Sent/Diff tabs when we have BOTH received and sent params
const hasDiff = computed(() => {
  return parsedSentParms.value !== null && parsedRcvdParms.value !== null
})

const diffEntries = computed((): DiffEntry[] => {
  if (!parsedSentParms.value || !parsedRcvdParms.value) return []
  // Normalize both sides to ensure consistent comparison (e.g., [] vs {} for object fields)
  return computeDiff(normalizeServerParams(parsedSentParms.value), innerData.value)
})

function formatValue(val: any): string {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (typeof val === 'object') {
    return JSON.stringify(val)
  }
  return String(val)
}

const copyDiffToClipboard = async () => {
  try {
    const text = diffEntries.value
      .map((d) => {
        if (d.type === 'added') return `+ ${d.path}: ${formatValue(d.newValue)}`
        if (d.type === 'removed') return `- ${d.path}: ${formatValue(d.oldValue)}`
        return `~ ${d.path}: ${formatValue(d.oldValue)} -> ${formatValue(d.newValue)}`
      })
      .join('\n')
    await navigator.clipboard.writeText(text || 'No differences')
    logger.debug('Copied diff to clipboard')
  } catch (err) {
    logger.error('Failed to copy diff', { error: err instanceof Error ? err.message : String(err) })
  }
}

// Re-highlight when data changes
watch(parsedData, () => {
  void nextTick()
})
</script>

<template>
  <Tabs v-model:value="activeTab">
    <TabList>
      <Tab value="0" :title="`${tooltipPrefix} JSON`">JSON</Tab>
      <Tab value="1" :title="`${tooltipPrefix} Python`">Python</Tab>
      <Tab value="2" :title="`${tooltipPrefix} Lua`">Lua</Tab>
      <Tab value="3" title="Request parameters used in a python code example">Python Code</Tab>
      <Tab v-if="hasDiff" value="4" title="The exact parameters sent by this web client">Sent</Tab>
      <Tab
        v-if="hasDiff"
        value="5"
        title="The difference between the parameters sent by this web client and those used by the server"
        >Diff</Tab
      >
    </TabList>

    <TabPanels>
      <!-- JSON Tab -->
      <TabPanel value="0">
        <div class="tab-content">
          <div class="button-row">
            <Button label="Copy JSON" size="small" icon="pi pi-copy" @click="copyJsonToClipboard" />
          </div>
          <pre v-html="highlightedJson"></pre>
        </div>
      </TabPanel>

      <!-- Python Tab -->
      <TabPanel value="1">
        <div class="tab-content">
          <div class="button-row">
            <Button
              label="Copy Python"
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

      <!-- Sent Tab (original sent parameters) -->
      <TabPanel v-if="hasDiff" value="4">
        <div class="tab-content">
          <div class="button-row">
            <Button
              label="Copy JSON"
              size="small"
              icon="pi pi-copy"
              @click="copySentJsonToClipboard"
            />
          </div>
          <pre v-html="highlightedSentJson"></pre>
        </div>
      </TabPanel>

      <!-- Diff Tab -->
      <TabPanel v-if="hasDiff" value="5">
        <div class="tab-content">
          <div class="button-row">
            <Button label="Copy Diff" size="small" icon="pi pi-copy" @click="copyDiffToClipboard" />
          </div>
          <div class="diff-container">
            <div v-if="diffEntries.length === 0" class="no-diff">
              No differences between sent and received parameters
            </div>
            <div v-else class="diff-list">
              <div
                v-for="(entry, index) in diffEntries"
                :key="index"
                :class="['diff-entry', `diff-${entry.type}`]"
              >
                <span class="diff-icon">
                  {{ entry.type === 'added' ? '+' : entry.type === 'removed' ? '-' : '~' }}
                </span>
                <span class="diff-path">{{ entry.path }}</span>
                <span class="diff-value">
                  <template v-if="entry.type === 'added'">
                    {{ formatValue(entry.newValue) }}
                  </template>
                  <template v-else-if="entry.type === 'removed'">
                    {{ formatValue(entry.oldValue) }}
                  </template>
                  <template v-else>
                    <span class="old-value">{{ formatValue(entry.oldValue) }}</span>
                    <span class="arrow"> -> </span>
                    <span class="new-value">{{ formatValue(entry.newValue) }}</span>
                  </template>
                </span>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>

<style scoped>
pre {
  background-color: #1e1e1e;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.9rem;
  max-height: 50vh;
  overflow-y: auto;
  margin: 0;
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

.diff-container {
  background-color: #1e1e1e;
  padding: 1rem;
  border-radius: 8px;
  max-height: 50vh;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.9rem;
}

.no-diff {
  color: #888;
  text-align: center;
  padding: 2rem;
}

.diff-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.diff-entry {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.diff-added {
  background-color: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.diff-removed {
  background-color: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.diff-changed {
  background-color: rgba(234, 179, 8, 0.15);
  color: #fbbf24;
}

.diff-icon {
  font-weight: bold;
  width: 1rem;
  flex-shrink: 0;
}

.diff-path {
  color: #93c5fd;
  flex-shrink: 0;
}

.diff-path::after {
  content: ':';
  margin-right: 0.5rem;
}

.diff-value {
  word-break: break-all;
}

.old-value {
  text-decoration: line-through;
  opacity: 0.7;
}

.arrow {
  color: #888;
}

.new-value {
  color: #4ade80;
}
</style>
