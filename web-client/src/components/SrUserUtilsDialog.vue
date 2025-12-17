<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import SrUserInfo from '@/components/SrUserInfo.vue'
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
    header="User Utilities"
    :closable="true"
    modal
    class="sr-user-utils-dialog"
    :style="{ width: '35rem' }"
  >
    <div class="sr-user-utils-content">
      <div class="sr-user-utils-section">
        <SrUserInfo />
      </div>
      <div class="sr-user-utils-section">
        <SrTokenUtil />
      </div>
    </div>

    <template #footer>
      <div class="sr-dialog-footer">
        <Button label="Close" severity="secondary" @click="closeDialog" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.sr-user-utils-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sr-user-utils-section {
  border-bottom: 1px solid var(--p-surface-border);
  padding-bottom: 1rem;
}

.sr-user-utils-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.sr-dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
