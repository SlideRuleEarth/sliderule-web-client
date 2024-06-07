// src/components/ConsoleTerminal.vue
<template>

    <h3 class="term-hdr"> Server Console Terminal </h3>
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
.term-hdr {
  font-size:medium;
  font-weight: bold;
  text-align: center;
  margin-top: 0.5rem;
}

.terminal {
  max-height: 20rem;
  width: 100%;
  background-color: #000;
  color: #0f0;
  font-family: 'Courier New', Courier, monospace;
  overflow-y: auto;
  overflow-x: auto; 
  padding: 0.625rem;
  min-width: 10rem;
  max-width: 15rem; 
} 

.terminal-content {
  display: flex;
  flex-direction: column;
}
.terminal-line {
  white-space: nowrap;
}
</style>
