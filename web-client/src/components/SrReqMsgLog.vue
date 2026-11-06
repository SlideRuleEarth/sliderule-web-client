<script setup lang="ts">
import DOMPurify from 'dompurify'
import { useReqMsgLogStore } from '@/stores/reqMsgLogStore'

const msgLogStore = useReqMsgLogStore()

const formatTime = (time: Date): string => time.toLocaleTimeString([], { hour12: false })
const sanitize = (detail: string): string => DOMPurify.sanitize(detail)
</script>

<template>
  <div
    class="sr-msg-log"
    id="sr-msg-log"
    role="log"
    aria-live="polite"
    aria-label="Request messages"
    tabindex="0"
  >
    <div v-if="msgLogStore.entries.length === 0" class="sr-msg-empty">No messages yet</div>
    <div
      v-for="entry in msgLogStore.entries"
      :key="entry.id"
      class="sr-msg-entry"
      :class="`sr-msg-${entry.severity}`"
    >
      <span class="sr-msg-time">{{ formatTime(entry.time) }}</span>
      <span v-if="entry.summary" class="sr-msg-summary">{{ entry.summary }}:</span>
      <span class="sr-msg-detail" v-html="sanitize(entry.detail)"></span>
    </div>
  </div>
</template>

<style scoped>
.sr-msg-log {
  --sr-msg-line-height: 1.35;
  width: 100%;
  /* Room for three lines of text; drag the corner to enlarge */
  height: calc(3 * var(--sr-msg-line-height) * 1em + 1rem);
  min-height: calc(2 * var(--sr-msg-line-height) * 1em + 1rem);
  resize: vertical;
  overflow-x: hidden;
  overflow-y: auto;
  background-color: #2c2c2c;
  border-radius: 0.5rem;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.7rem;
  line-height: var(--sr-msg-line-height);
}

.sr-msg-entry {
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.sr-msg-entry + .sr-msg-entry {
  border-top: 1px solid #3c3c3c;
}

.sr-msg-time {
  opacity: 0.6;
  margin-right: 0.35rem;
}

.sr-msg-summary {
  font-weight: 600;
  margin-right: 0.35rem;
}

.sr-msg-detail :deep(ul) {
  margin: 0;
  padding-left: 1rem;
}

.sr-msg-empty {
  opacity: 0.6;
}

.sr-msg-success .sr-msg-summary {
  color: #6fcf7f;
}

.sr-msg-warn .sr-msg-summary {
  color: #ffc857;
}

.sr-msg-error {
  color: #ff7b7b;
}

.sr-msg-server .sr-msg-summary {
  color: #8ab4f8;
}
</style>
