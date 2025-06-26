<template>
  <div class="json-diff-viewer">
    <pre v-html="highlightedDiff"></pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/atom-one-dark.css'

hljs.registerLanguage('json', json)

const props = defineProps<{
  before: object
  after: object
}>()

function highlightJson(value: unknown): string {
  try {
    const jsonStr = JSON.stringify(value, null, 2)
    return hljs.highlight(jsonStr, { language: 'json' }).value
  } catch {
    return String(value)
  }
}

function diffJson(before: any, after: any, path: string[] = []): string[] {
  const diffLines: string[] = []

  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  for (const key of allKeys) {
    const currentPath = [...path, key]
    const fullKey = currentPath.join('.')

    if (!(key in after)) {
      diffLines.push(`<div class="removed">- ${fullKey}: ${highlightJson(before[key])}</div>`)
    } else if (!(key in before)) {
      diffLines.push(`<div class="added">+ ${fullKey}: ${highlightJson(after[key])}</div>`)
    } else {
      const beforeVal = before[key]
      const afterVal = after[key]

      if (
        typeof beforeVal === 'object' &&
        typeof afterVal === 'object' &&
        beforeVal &&
        afterVal &&
        !Array.isArray(beforeVal) &&
        !Array.isArray(afterVal)
      ) {
        diffLines.push(...diffJson(beforeVal, afterVal, currentPath))
      } else if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        diffLines.push(`<div class="changed">~ ${fullKey}:<br>&nbsp;&nbsp;${highlightJson(beforeVal)}<br>&nbsp;&nbsp;→ ${highlightJson(afterVal)}</div>`)
      }
    }
  }

  return diffLines
}

const highlightedDiff = computed(() => {
  return diffJson(props.before, props.after).join('\n')
})
</script>

<style scoped>
.json-diff-viewer {
  font-family: monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  padding: 1em;
  border: 1px solid #ccc;
  background-color: #1e1e1e;
  color: #eee;
  overflow-x: auto;
}

.added {
  color: #81f781;
}

.removed {
  color: #f78c6c;
}

.changed {
  color: #ffd580;
}

.hljs {
  display: inline;
}
</style>
