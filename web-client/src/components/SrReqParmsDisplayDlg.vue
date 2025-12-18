<script setup lang="ts">
import Dialog from 'primevue/dialog'
import SrParmsFormatTabs from './SrParmsFormatTabs.vue'

const props = defineProps<{
  rcvdParms: object | string | null
  width?: string
  title?: string
  endpoint?: string
}>()

const modelValue = defineModel<boolean>({ default: false })
</script>

<template>
  <Dialog
    v-model:visible="modelValue"
    :modal="true"
    :closable="true"
    :style="{ width: props.width || '80vw' }"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-title">{{ props.title || 'Request Parameters' }}</div>
      </div>
    </template>

    <SrParmsFormatTabs :rcvdParms="props.rcvdParms" :endpoint="props.endpoint" />
  </Dialog>
</template>

<style scoped>
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.dialog-title {
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
}
</style>
