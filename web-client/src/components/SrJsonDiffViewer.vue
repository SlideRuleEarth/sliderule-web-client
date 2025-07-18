<template>
  <div class="json-diff-side-by-side">
    <table>
      <thead>
        <tr>
            <th>Field</th>
            <th>{{ props.beforeLabel }}</th>
            <th>{{ props.afterLabel }}</th>
            <th>
                <Button
                    label="Apply"
                    icon="pi pi-check"
                    size="small"
                    @click="forceChanges"
                    class="sr-glow-button"
                />
            </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in diffRows" :key="index">
            <td :class="row.fieldClass">{{ row.path }}</td>
            <td :class="['before', row.beforeClass]" v-html="row.before"></td>
            <td :class="['after', row.afterClass]" v-html="row.after"></td>
            <td class="force-cell">
                <template v-if="!props.automaticFields.has(row.path.split('.').at(-1)!)">
                    <div
                        v-if="row.aVal === undefined"
                        class="force-checkbox"
                    >
                        <Checkbox v-model="row.forceAdd" :inputId="`force-add-${index}`" binary class="p-checkbox-sm" />
                        <label :for="`force-add-${index}`">add</label>
                    </div>
                    <div
                        v-if="(row.aVal !== undefined) && (row.bVal === undefined)"
                        class="force-checkbox"
                    >
                        <Checkbox v-model="row.forceRemove" :inputId="`force-remove-${index}`" binary class="p-checkbox-sm" />
                        <label :for="`force-remove-${index}`">remove</label>
                    </div>
                </template>
            </td>
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
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { ref, watchEffect, nextTick } from 'vue'

const reqParamsStore = useReqParamsStore()

hljs.registerLanguage('json', json)

const internalDiff = computed(() => generateDiff(props.before, props.after, [], props.automaticFields))
const diffRows = ref<DiffRow[]>([])

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
    fieldClass: string
    beforeClass: string
    afterClass: string
    forceAdd?: boolean
    forceRemove?: boolean
    aVal?: unknown // Add this field to allow template logic
    bVal?: unknown
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
        let fieldClass = 'field-normal';
        let beforeClass = 'before-red';
        let afterClass = 'after-green';
        if (
            bVal && aVal &&
            typeof bVal === 'object' &&
            typeof aVal === 'object' &&
            !Array.isArray(bVal) &&
            !Array.isArray(aVal)
        ) {
            rows.push(...generateDiff(bVal, aVal, [...path, key], automaticFields))
        } else if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
            let beforeDisplay: string;
            let afterDisplay: string;

            if (bVal !== undefined) {
                beforeDisplay = highlight(bVal);
                if((bVal === false) && (aVal === undefined)){
                    beforeClass = 'before-implied';
                }
            } else if (automaticFields.has(key)) {
                beforeDisplay = '<i class="missing">(automatic)</i>';
                beforeClass = 'before-automatic';
            } else if (typeof aVal === 'boolean' || typeof bVal === 'boolean') {
                beforeDisplay = '<i class="missing">(implied)</i>';
                beforeClass = 'before-implied';
            } else {
                beforeDisplay = '<i class="missing">(missing)</i>';
            }

            if (aVal === undefined) {
                if (automaticFields.has(key)) {
                    afterDisplay = '<i class="sw-error">(automatic)</i>';
                    afterClass = 'after-automatic';
                } else if (typeof bVal === 'boolean') {
                    if(bVal === true){
                        afterDisplay = '<i class="missing">(missing)</i>';
                        afterClass = 'sw-warning';
                    } else {
                        afterDisplay = '<i class="missing">(implied)</i>';
                        afterClass = 'after-implied';
                    }
                } else {
                    afterDisplay = '<i class="missing">(missing)</i>';
                }
            } else {
                afterDisplay = highlight(aVal);
            }

            rows.push({
                path: fullPath,
                before: beforeDisplay,
                after: afterDisplay,
                fieldClass,
                beforeClass,
                afterClass,
                aVal, // include raw value for template logic
                bVal 
            });

        } else {
            // OPTIONAL: show unchanged rows (up to you)
            /*
            rows.push({
                path: fullPath,
                before: highlight(bVal),
                after: highlight(aVal),
                fieldClass: 'field-italic',
                beforeClass: 'before-unchanged',
                afterClass: 'after-unchanged'
            });
            */
        }

    }

    return rows
}

watchEffect(() => {
    diffRows.value = internalDiff.value
})

const emit = defineEmits<{
  (e: 'forced-req_params', index: number): void
}>()

function forceChanges() {
    const added: Record<string, unknown> = {}
    const removed: string[] = []
    let updated = false;

    for (const row of diffRows.value) {
        if (row.forceAdd) {
            added[row.path] = row.bVal
            updated = true;
        }
        if (row.forceRemove) {
            removed.push(row.path)
            updated = true;
        }
    }

    reqParamsStore.forcedAddedParams = added
    reqParamsStore.forcedRemovedParams = removed

    if (updated) {
        console.log('Forced Request parameters:', reqParamsStore.forcedAddedParams)
        nextTick(() => {
            emit('forced-req_params', 0)
        })
    }
}

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

.field-normal {
  font-weight: bold;
  width: 25%;
}

.field-italic {
  font-style: italic;
  font-weight: bold;
  width: 25%;
}

.before {
  background-color: #2b1d1d;
  width: 37.5%;
}

.before-red {
  background-color: #2b1d1d;
  width: 37.5%;
}

.before-green {
  background-color: #1d2b1d;
  width: 37.5%;
}

.after {
  background-color: #1d2b1d;
  width: 37.5%;
}

.after-green {
  background-color: #1d2b1d;
  width: 37.5%;
}

.after-red {
  background-color: #2b1d1d;
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

.before-automatic {
  background-color: #1d1d2b; /* bluish tone */
}

.after-automatic {
  background-color: #1d1d2b;
}

.before-implied {
  background-color: #2b2b1d; /* yellowish tone */
}

.after-implied {
  background-color: #2b2b1d;
}

.before-unchanged,
.after-unchanged {
  background-color: #222; /* neutral gray */
}
.force-cell {
  background-color: #1e1e1e;
  color: #ccc;
  padding: 0.5rem;
  text-align: left;
}

.force-checkbox {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.25rem;
}

</style>
