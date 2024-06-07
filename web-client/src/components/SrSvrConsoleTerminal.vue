// src/components/ConsoleTerminal.vue
<template>
  <div class="terminal" ref="terminalContent">
    <div class="terminal-content">
      <div v-for="(line, index) in lines" :key="index" class="terminal-line">
        {{ line }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useSrSvrConsoleStore } from '@/stores/SrSvrConsoleStore';

const consoleStore = useSrSvrConsoleStore();
const terminalContent = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
  if (terminalContent.value) {
    terminalContent.value.scrollTop = terminalContent.value.scrollHeight;
  }
};

onMounted(() => {
  scrollToBottom();
});

watch(consoleStore.lines, () => {
  scrollToBottom();
});

const lines = consoleStore.lines;
</script>

<style scoped>
.terminal {
  height: 400px;
  width: 100%;
  background-color: #000;
  color: #0f0;
  font-family: 'Courier New', Courier, monospace;
  overflow-y: auto;
  padding: 10px;
}
.terminal-content {
  display: flex;
  flex-direction: column;
}
.terminal-line {
  white-space: pre-wrap;
}
</style>
