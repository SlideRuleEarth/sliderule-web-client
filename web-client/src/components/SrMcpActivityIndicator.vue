<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import ConfirmDialog from 'primevue/confirmdialog'
import { useMcpStore } from '@/stores/mcpStore'
import { connect, disconnect } from '@/services/mcpClient'

const mcpStore = useMcpStore()
const popover = ref()

const statusColor = computed(() => {
  switch (mcpStore.status) {
    case 'connected':
      return 'var(--p-green-400)'
    case 'connecting':
    case 'reconnecting':
      return 'var(--p-yellow-400)'
    default:
      return 'var(--p-surface-400)'
  }
})

const statusLabel = computed(() => {
  switch (mcpStore.status) {
    case 'connected':
      return 'MCP'
    case 'connecting':
    case 'reconnecting':
      return 'MCP...'
    default:
      return 'MCP'
  }
})

const toggleLabel = computed(() => (mcpStore.isConnected ? 'Disconnect' : 'Connect'))

function toggleConnection() {
  if (mcpStore.isConnected || mcpStore.status === 'reconnecting') {
    disconnect()
  } else {
    connect()
  }
}

function togglePanel(event: Event) {
  popover.value?.toggle(event)
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}
</script>

<template>
  <ConfirmDialog group="mcp" />
  <div class="sr-mcp-indicator">
    <Button
      class="p-button-text p-button-rounded p-button-sm"
      :label="statusLabel"
      size="small"
      @click="togglePanel"
    >
      <template #icon>
        <span class="sr-mcp-dot" :style="{ backgroundColor: statusColor }"></span>
      </template>
    </Button>
    <Popover ref="popover" :style="{ width: '380px' }">
      <div class="sr-mcp-panel">
        <div class="sr-mcp-panel-header">
          <span class="sr-mcp-panel-status">{{ mcpStore.status }}</span>
          <Button :label="toggleLabel" size="small" @click="toggleConnection" />
        </div>
        <div v-if="mcpStore.lastError" class="sr-mcp-panel-error">
          {{ mcpStore.lastError }}
        </div>
        <div v-if="mcpStore.recentActivity.length > 0" class="sr-mcp-panel-log">
          <div
            v-for="(entry, i) in [...mcpStore.recentActivity].reverse()"
            :key="i"
            class="sr-mcp-log-entry"
            :class="{ 'sr-mcp-log-error': entry.isError }"
          >
            <span class="sr-mcp-log-time">{{ formatTime(entry.timestamp) }}</span>
            <span
              v-if="entry.direction === 'inbound'"
              class="sr-mcp-log-direction"
              title="Request from Claude"
              >&#x2192;</span
            >
            <span v-else class="sr-mcp-log-direction" title="Response to Claude">&#x2190;</span>
            <span class="sr-mcp-log-summary">{{ entry.summary }}</span>
            <span v-if="entry.durationMs" class="sr-mcp-log-duration"
              >{{ entry.durationMs }}ms</span
            >
          </div>
        </div>
        <div v-else class="sr-mcp-panel-empty">No activity yet</div>
      </div>
    </Popover>
  </div>
</template>

<style scoped>
.sr-mcp-indicator {
  display: inline-flex;
  align-items: center;
}
.sr-mcp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
}
.sr-mcp-panel {
  max-height: 350px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.sr-mcp-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sr-mcp-panel-status {
  font-weight: 600;
  text-transform: capitalize;
}
.sr-mcp-panel-error {
  font-size: 0.8rem;
  color: var(--p-red-400);
}
.sr-mcp-panel-log {
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sr-mcp-log-entry {
  font-size: 0.75rem;
  font-family: monospace;
  padding: 2px 4px;
  border-radius: 2px;
  display: flex;
  gap: 4px;
  align-items: baseline;
}
.sr-mcp-log-entry:nth-child(odd) {
  background: var(--p-surface-50);
}
.sr-mcp-log-time {
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}
.sr-mcp-log-direction {
  flex-shrink: 0;
}
.sr-mcp-log-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.sr-mcp-log-duration {
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}
.sr-mcp-log-error {
  color: var(--p-red-400);
}
.sr-mcp-panel-empty {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  text-align: center;
  padding: 1rem;
}
</style>
