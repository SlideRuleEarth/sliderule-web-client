<template>
    <Fieldset legend="32-Bit Flag" class="sr-32bit-flag-fieldset" :toggleable="true" :collapsed="!rasterParamsStore.withFlags" :disabled="props.disabled">
        <div class="bit-grid">
            <div v-for="i in 32" :key="i" class="bit">
                <Checkbox
                    v-model="bits[31 - (i - 1)]"
                    :binary="true"
                    :label="31 - (i - 1)"
                    :disabled="props.disabled"
                />
            </div>

            <div class="flag-summary">
                <p>Decimal: {{ flagValue }}</p>
                <p>Hex: 0x{{ flagValue.toString(16).toUpperCase().padStart(8, '0') }}</p>
            </div>
        </div>
    </Fieldset>    
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Checkbox from 'primevue/checkbox';
import Fieldset from 'primevue/fieldset';
import { useRasterParamsStore } from '@/stores/rasterParamsStore';

const props = defineProps<{
  disabled?: boolean;
}>();

const rasterParamsStore = useRasterParamsStore();
const bits = ref<boolean[]>(Array(32).fill(false));

const flagValue = computed(() => {
  return bits.value.reduce((acc, val, idx) => {
    return acc | ((val ? 1 : 0) << idx);
  }, 0);
});
</script>

<style scoped>
.bit-grid {
  display: grid;
  grid-template-columns: repeat(8, auto);
  gap: 8px;
}
.flag-summary {
  grid-column: span 8;
  margin-top: 16px;
}
</style>
