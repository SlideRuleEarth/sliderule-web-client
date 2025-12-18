<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import SrUserInfo from '@/components/SrUserInfo.vue'

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
    header="User Info"
    :closable="true"
    modal
    class="sr-user-utils-dialog"
    :style="{ width: '35rem' }"
  >
    <div class="sr-user-utils-content">
      <SrUserInfo />
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
}

.sr-dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
