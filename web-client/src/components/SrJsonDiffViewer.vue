<template>
  <div class="json-diff-side-by-side">
    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>{{ props.beforeLabel }}</th>
          <th>{{ props.afterLabel }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in diffRows" :key="index">
          <td class="field">{{ row.path }}</td>
          <td class="before" v-html="row.before"></td>
          <td class="after" v-html="row.after"></td>
        </tr>
      </tbody>
    </table>
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
  automaticFields: Set<string>
  beforeLabel?: string
  afterLabel?: string
}>()

interface DiffRow {
  path: string
  before: string
  after: string
  
}

function highlight(value: unknown): string {
  try {
    return hljs.highlight(JSON.stringify(value, null, 2), { language: 'json' }).value
  } catch {
    return String(value)
  }
}

function generateDiff(
    before: any,
    after: any,
    path: string[] = [],
    automaticFields: Set<string> = new Set()
): DiffRow[] {
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
    const rows: DiffRow[] = []

    for (const key of keys) {
        const fullPath = [...path, key].join('.')
        const bVal = before?.[key]
        const aVal = after?.[key]

        if (
            bVal && aVal &&
            typeof bVal === 'object' &&
            typeof aVal === 'object' &&
            !Array.isArray(bVal) &&
            !Array.isArray(aVal)
        ) {
            rows.push(...generateDiff(bVal, aVal, [...path, key], automaticFields))
        } else if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
            let beforeDisplay: string

            if (bVal !== undefined) {
                beforeDisplay = highlight(bVal)
            } else if (automaticFields.has(key)) {
                beforeDisplay = '<i class="missing">(automatic)</i>'
            } else if (typeof bVal === 'boolean') {
                beforeDisplay = '<i class="missing">(implied)</i>'
            } else {
                beforeDisplay = '<i class="missing">(missing)</i>'
            }
            let afterDisplay: string

            if (aVal === undefined){
                if(automaticFields.has(key)) {
                    afterDisplay = '<i class="sw-error">(automatic)</i>'
                } else if (typeof bVal === 'boolean') { // check the before value type
                    afterDisplay = '<i class="missing">(implied)</i>'
                } else {
                    afterDisplay = '<i class="missing">(missing)</i>'
                }
            } else {
                afterDisplay = highlight(aVal)
            }

            rows.push({
                path: fullPath,
                before: beforeDisplay,
                after: afterDisplay
            })
        }
    }

    return rows
}

const diffRows = computed(() => generateDiff(props.before, props.after, [], props.automaticFields))
</script>

<style scoped>
.json-diff-side-by-side {
  font-family: monospace;
  background-color: #1e1e1e;
  color: #eee;
  padding: 1rem;
  overflow-x: auto;
  border-radius: 6px;
}

.json-diff-side-by-side table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.json-diff-side-by-side th,
.json-diff-side-by-side td {
  border: 1px solid #444;
  padding: 0.5rem;
  vertical-align: top;
}

.json-diff-side-by-side th {
  background-color: #2e2e2e;
}

.field {
  font-weight: bold;
  width: 25%;
}

.before {
  background-color: #2b1d1d;
  width: 37.5%;
}

.after {
  background-color: #1d2b1d;
  width: 37.5%;
}

.missing {
  color: #f3d008;
  font-style: italic;
}
.sw-error {
  color: #ff6c6b;
  font-style: italic;
}
</style>
