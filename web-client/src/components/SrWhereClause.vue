<template>
    <div class="sr-where-toolbar">
        <span class="sr-where-hint"><pre class="sr-where-pre">{{ whereClause || '—' }}</pre></span>
    </div>

</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { createWhereClause } from '@/utils/spotUtils'; 


const recTreeStore = useRecTreeStore();

const reqId = computed<number | null>(() => {
    // Prefer a numeric id if you store it; otherwise parse the string form
    if (typeof recTreeStore.selectedReqId === 'number') return recTreeStore.selectedReqId;
    const s = recTreeStore.selectedReqIdStr;
    const n = s ? Number.parseInt(s) : NaN;
    return Number.isFinite(n) ? n : null;
});

const whereClause = computed(() => {
    if (reqId.value == null) return '';
    // createWhereClause reads reactive stores inside; Vue will track them
    try {
        return createWhereClause(reqId.value);
    } catch (e) {
        console.warn('SrWhereClause: failed to build where clause', e);
        return '';
    }
});

</script>

<style scoped>
.sr-where-fieldset {
    width: 100%;
    margin-top: 0.5rem;
}
.sr-where-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
}
.sr-where-hint {
    font-size: small;
    opacity: 0.75;
}
.sr-where-pre {
    margin: 0;
    padding: 0.5rem;
    width: fit-content;        /* shrink to text */
    max-width: 30rem;          /* but no wider than 50rem */
    white-space: pre-wrap;     /* keep whitespace, allow wrapping */
    word-break: break-word;    /* break long words/tokens */
    overflow-wrap: anywhere;   /* extra safety for long strings */
    background: var(--surface-100, rgba(127,127,127,0.08));
    border-radius: 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
    font-size: small;
}


</style>
