<script setup lang="ts">
import { computed, watch } from 'vue'
import Select from 'primevue/select'
import { useMapStore } from '@/stores/mapStore'
import { statColumnLabel } from '@/composables/useAtl06StatsOverlay'
import type { StatColumn } from '@/utils/atl06StatsReader'

const DEFAULT_COLUMN = 'h_li_mean'

const props = defineProps<{
  columns: StatColumn[] // empty until the first stats file has been read
}>()

const mapStore = useMapStore()

const options = computed(() => {
  const names = props.columns.length ? props.columns.map((c) => c.name) : [mapStore.s2StatsColumn]
  return names.map((name) => ({ label: statColumnLabel(name), value: name }))
})

const selected = computed({
  get: () => mapStore.s2StatsColumn,
  set: (value: string) => mapStore.setS2StatsColumn(value)
})

watch(
  () => props.columns,
  (columns) => {
    if (columns.length && !columns.some((c) => c.name === mapStore.s2StatsColumn)) {
      const fallback = columns.find((c) => c.name === DEFAULT_COLUMN) ?? columns[0]
      mapStore.setS2StatsColumn(fallback.name)
    }
  },
  { immediate: true }
)
</script>

<template>
  <Select
    v-model="selected"
    :options="options"
    optionLabel="label"
    optionValue="value"
    title="ATL06 stat shown in the S2 cells"
    class="sr-stats-column-select"
    size="small"
  />
</template>

<style scoped>
.sr-stats-column-select {
  min-width: 7rem;
}
</style>
