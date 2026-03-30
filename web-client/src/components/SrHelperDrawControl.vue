<template>
  <SrDrawButtonBox ref="drawButtonBox" @picked-changed="handlePickedChange" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Control } from 'ol/control'
import SrDrawButtonBox from './SrDrawButtonBox.vue'
import { useHelperMapStore } from '@/stores/helperMapStore'

const helperStore = useHelperMapStore()

const emit = defineEmits(['draw-control-created', 'picked-changed'])

const drawButtonBox = ref<InstanceType<typeof SrDrawButtonBox> | null>(null)

onMounted(() => {
  const element = document.createElement('div')
  element.className = 'sr-draw-control ol-unselectable ol-control'
  if (drawButtonBox.value) {
    element.appendChild(drawButtonBox.value.$el)
  }

  const customControl = new Control({ element })
  emit('draw-control-created', customControl)
})

defineExpose({
  resetPicked() {
    drawButtonBox.value?.resetPicked()
  }
})

const handlePickedChange = (newPickedValue: string) => {
  helperStore.setDrawType(newPickedValue)
  emit('picked-changed', newPickedValue)
}
</script>
