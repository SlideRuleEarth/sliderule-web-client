<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import SrTokenUtil from '@/components/SrTokenUtil.vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

function closeDialog() {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    header="Token Utilities"
    :closable="true"
    modal
    class="sr-token-utils-dialog"
    :style="{ width: '35rem' }"
  >
    <div class="sr-token-utils-content">
      <SrTokenUtil />
    </div>

    <template #footer>
      <div class="sr-dialog-footer">
        <Button label="Close" severity="secondary" @click="closeDialog" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.sr-token-utils-content {
  display: flex;
  flex-direction: column;
}

.sr-dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
