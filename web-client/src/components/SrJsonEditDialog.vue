<script setup lang="ts">
import { ref, computed, watchEffect, onMounted, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/atom-one-dark.css'
import type { ZodTypeAny } from 'zod'
import SrJsonReqImporter from './SrJsonReqImporter.vue'

hljs.registerLanguage('json', json)

const props = withDefaults(defineProps<{
  jsonData: object | string | null,
  readonlyStoreValue?: () => object | string | null,
  editable?: boolean,
  width?: string,
  title?: string,
  zodSchema?: ZodTypeAny
}>(), {
  editable: false,
  width: '60vw',
  title: 'JSON Viewer'
})

const emit = defineEmits<{
  (e: 'json-valid', value: any): void
}>()

const modelValue = defineModel<boolean>({ default: false })
const jsonBlock = ref<HTMLElement | null>(null)
const rawJson = ref('')
const isValidJson = ref(true)
const validationError = ref<string | null>(null)
const readonlyPrettyJson = computed(() => {
  try {
    const obj = typeof props.readonlyStoreValue === 'function'
      ? props.readonlyStoreValue()
      : null;
    if (!obj) return 'No data';
    const parsed = typeof obj === 'string' ? JSON.parse(obj) : obj;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return 'Invalid JSON';
  }
});

const readonlyHighlightedJson = computed(() => {
  return hljs.highlight(readonlyPrettyJson.value, { language: 'json' }).value;
});

const prettyJson = computed(() => {
  try {
    const jsonObj = typeof props.jsonData === 'string'
      ? JSON.parse(props.jsonData)
      : props.jsonData
    return JSON.stringify(jsonObj, null, 2)
  } catch {
    return 'Invalid JSON'
  }
})

const highlightedJson = computed(() => {
  return hljs.highlight(prettyJson.value, { language: 'json' }).value
})

function updateRawJson() {
  rawJson.value = prettyJson.value
  console.log('Updated rawJson:', rawJson.value)
}

function validateJson() {
  try {
    const parsed = JSON.parse(rawJson.value)
    if (props.zodSchema) {
      const result = props.zodSchema.safeParse(parsed)
      if (!result.success) {
        isValidJson.value = false
        validationError.value = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n')
        return
      } else {
        emit('json-valid', result.data)
      }
    }
    isValidJson.value = true
    validationError.value = null
  } catch (err) {
    isValidJson.value = false
    validationError.value = 'Invalid JSON format'
  }
}
const copyRawToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(rawJson.value);
    console.log('Raw JSON Copied to clipboard');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};
const copyCleanToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(prettyJson.value);
    console.log('Copied to clipboard');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

watchEffect(() => {
  if (modelValue.value || prettyJson.value !== rawJson.value) {
    updateRawJson()
    nextTick(() => highlightJson())
  }
})

const highlightJson = () => {
  if (jsonBlock.value) {
    hljs.highlightElement(jsonBlock.value);
  }
}

onMounted(() => {
  if (modelValue.value) highlightJson()
  console.log('Mounted SrJsonEditDialog editable:', props.editable);
})
</script>

<template>
  <Dialog 
    v-model:visible="modelValue"
    :modal="true"
    :closable="true"
    :style="{ width: props.width }"
    :header=props.title
  >
    <!-- Editable JSON -->
    <div v-if="props.editable" class="json-dual-panel">
        <!-- Editable panel -->
        <div class="json-pane">
            <h3 class="pane-title">Editable Request</h3>
            <Textarea
                v-model="rawJson"
                autoResize
                rows="20"
                class="w-full"
                @input="validateJson"
                :class="{ 'p-invalid': !isValidJson }"
            />
            <div v-if="!isValidJson" class="error-text">
                {{ validationError }}
            </div>
            <div class="copy-btn-container">
                <Button 
                    label="Copy to clipboard" 
                    size="small" 
                    icon="pi pi-copy" 
                    @click="copyRawToClipboard" 
                    class="copy-btn" 
                />
            </div>
        </div>

        <!-- Readonly panel -->
        <div class="json-pane">
            <h3 class="pane-title">Current Request to use</h3>
            <pre ref="jsonBlock" v-html="readonlyHighlightedJson"></pre>
            <div class="copy-btn-container">
                <Button 
                label="Copy to clipboard" 
                size="small" 
                icon="pi pi-copy" 
                @click="copyCleanToClipboard" 
                class="copy-btn" 
                />
            </div>
        </div>
    </div>

  </Dialog>
</template>

<style scoped>
pre {
  background-color: #1e1e1e;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.9rem;
  color: white;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}
.copy-btn {
  flex-shrink: 0;
}
.dialog-title {
  flex: 1;
  text-align: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: bold;
}
.json-dual-panel {
  display: flex;
  gap: 1rem;
}

.json-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.pane-title {
  font-weight: bold;
  margin-bottom: 0.5rem;
  text-align: center;
}

pre {
  background-color: #1e1e1e;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.9rem;
  color: white;
  white-space: pre-wrap;
  flex: 1;
}

.copy-btn-container {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}

.copy-btn {
  width: auto;
  padding: 0.4rem 0.75rem;
}
.error-text {
    color: #ef4444;
    margin-top: 0.5rem;
    white-space: pre-line;
}

</style>
