// src/components/ConsoleTerminal.vue
<template>
  <div class="sr-terminal">
    <div>
      <h3 class="sr-term-hdr"> Server Console Terminal </h3>
    </div>
    <div class="sr-terminal-content">
      <div v-for="(line, index) in lines" :key="index" class="sr-terminal-line">
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


.sr-term-hdr {
  font-size:medium;
  font-weight: bold;
  text-align: center;
  margin-top: 0.5rem;
}

.sr-terminal {
  display: flex;
  flex-direction: column;
  width: 100%;
} 

.sr-terminal-content {
  background-color: #000;
  color: #0f0;
  font-family: 'Courier New', Courier, monospace;
  height: 20rem;
  overflow-y: auto;
  overflow-x: auto; 
  padding: 0.625rem;
  min-width: 25rem;  
  max-width: 25rem; 
}

.sr-terminal-line {
  white-space: nowrap;
}
</style>
