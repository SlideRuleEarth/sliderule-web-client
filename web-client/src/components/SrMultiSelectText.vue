<template>
    <div class="sr-menu-label-wrapper">
        <SrLabelInfoIconButton v-if="label" :label="label" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="insensitive"/>
        <MultiSelect v-model="selectedMenuItems" :options="menuOptions" optionLabel="name" :placeholder="menuPlaceholder" class="sr-multi-selector" :disabled="insensitive" /> 
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import MultiSelect from 'primevue/multiselect';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

export interface SrMultiSelectTextItem {
    name: string;
    value: string; 
}

const props = defineProps({
    label: {
        type: String,
        default: ''
    },
    menuPlaceholder: {
        type: String,
        default: 'Select...'
    },
    menuOptions: {
        type: Array as () => SrMultiSelectTextItem[],
        default: () => []
    },
    default: {
        type: Array as () => SrMultiSelectTextItem[],
        default: () => []
    },
    insensitive: {
        type: Boolean,
        default: false
    },
    tooltipText: {
        type: String,
        default: 'tooltip text'
    },
    tooltipUrl: {
        type: String,
        default: ''
    },
    modelValue: {
        type: Array as () => String[],
        default: () => []
    },
});

const selectedMenuItems = ref<SrMultiSelectTextItem[]>(props.default);
const emit = defineEmits(['update:modelValue']);

onMounted(() => {
    const values = selectedMenuItems.value.map(item => item.value);
    emit('update:modelValue', values);
    console.log('onMounted:', props.label, 'values:', values, 'Selected Items:', selectedMenuItems.value);
});

watch(() => selectedMenuItems.value, (newVal, oldVal) => {
    const values = newVal.map(item => item.value);
    emit('update:modelValue', values);
    console.log('watch:', props.label, 'values:', values, 'Selected Items:', selectedMenuItems.value);
});
</script>

<style scoped>
.sr-menu-label-wrapper {
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: center;
    width: 100%;
}

.sr-multi-selector {
    width: 75%;
    padding: 0.125rem;
    margin: 0.25rem;
    background-color: transparent;
}

.p-multiselect-item {
    font-size: small;
}

:deep(.p-multiselect-panel .p-multiselect-items .p-multiselect-item .p-checkbox) {
    width: 0.25rem;
    height: 0.25rem;
}

:deep(.p-multiselect .p-multiselect-trigger) {
    width: 0.75rem;
    height: 0.75rem;
    align-self: center;
}

:deep(.p-multiselect .p-multiselect-trigger .p-icon) {
    width: 0.65rem;
    height: 0.65rem;
}

:deep(.p-multiselect .p-multiselect-label) {
    display: flex;
    flex-direction: column;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    padding-left: 0.25rem;
    font-size: small;
}
</style>
