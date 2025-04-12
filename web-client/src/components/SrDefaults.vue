<template>
    <div class="defaults">
        <h1>SlideRule Defaults</h1>

        <p v-if="defaultsStore.loading">Loading defaults…</p>
        <p v-else-if="defaultsStore.error" class="text-red-500">Error: {{ defaultsStore.error.message }}</p>

        <Accordion v-if="defaultsStore.defaults" v-model:value="topLevelActive" :multiple="false">
            <!-- Formatted JSON Panel -->
            <AccordionPanel value="formatted">
                <AccordionHeader>Formatted</AccordionHeader>
                <AccordionContent>
                    <div class="flex gap-2 mb-2">
                        <Button @click="copyToClipboard" class="sr-glow-button">Copy</button>
                        <Button @click="downloadJSON" class="sr-glow-button">Download</button>
                    </div>
                    <pre class="text-sm bg-gray-100 p-4 overflow-auto whitespace-pre-wrap">
                        {{ formattedDefaults }}
                    </pre>
                </AccordionContent>
            </AccordionPanel>

            <!-- Sorted Section Panels -->
            <AccordionPanel
                v-for="section in sortedSections"
                :key="section.key"
                :value="section.key"
            >
                <AccordionHeader>{{ section.header }}</AccordionHeader>
                <AccordionContent>
                    <Accordion v-model:value="nestedActive[section.key]" :multiple="false">
                        <AccordionPanel
                            v-for="[key, value] in section.entries"
                            :key="key"
                            :value="key"
                        >
                            <AccordionHeader>{{ key }}</AccordionHeader>
                            <AccordionContent>
                                <div v-if="isPrimitive(value)">
                                    <span class="font-medium text-gray-700">{{ formatValue(value) }}</span>
                                </div>
                                <div v-else-if="Array.isArray(value)">
                                    <pre class="text-xs whitespace-pre-wrap text-gray-600">[{{ value.join(', ') }}]</pre>
                                </div>
                                <div v-else>
                                    <pre class="text-xs whitespace-pre-wrap text-gray-600">{{ formatObject(value) }}</pre>
                                </div>
                            </AccordionContent>
                        </AccordionPanel>
                    </Accordion>
                </AccordionContent>
            </AccordionPanel>
        </Accordion>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Button from 'primevue/button'
import { useSlideruleDefaults } from '@/stores/defaultsStore'

const defaultsStore = useSlideruleDefaults()
const isFetched = computed(() => defaultsStore.fetched && !defaultsStore.loading && !defaultsStore.error)
const formattedDefaults = computed(() => {
    return JSON.stringify(defaultsStore.defaults, null, 2)
})

onMounted(async () => {
    if (!isFetched.value) {
        await defaultsStore.getDefaults()
    }
})

function isPrimitive(val: unknown): boolean {
    return typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'
}

function formatValue(val: unknown): string {
    return String(val)
}

function formatObject(obj: unknown): string {
    return JSON.stringify(obj, null, 2)
}


type SectionEntry = {
    key: string
    header: string
    entries: [string, any][]
}

const sortedSections = computed<SectionEntry[]>(() => {
    const defaults = defaultsStore.defaults;
    if (!defaults) return []
    return Object.entries(defaults)
        .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
        .map(([sectionKey, section]) => ({
            key: sectionKey,
            header: sectionKey.toUpperCase(),
            entries: Object.entries(section).sort(([aKey], [bKey]) => aKey.localeCompare(bKey)),
     }))

})

// Accordion panel state
const topLevelActive = ref<string | null>(null)
const nestedActive = ref<Record<string, string | null>>({})

function copyToClipboard() {
    navigator.clipboard.writeText(formattedDefaults.value)
        .then(() => alert('Copied to clipboard'))
        .catch(err => alert('Copy failed: ' + err))
}

function downloadJSON() {
    const blob = new Blob([formattedDefaults.value], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sliderule-defaults.json'
    a.click()
    URL.revokeObjectURL(url)
}

</script>

<style scoped>
.defaults {
    padding: 1rem;
    font-family: system-ui, sans-serif;
}

h1 {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 1rem;
}
</style>