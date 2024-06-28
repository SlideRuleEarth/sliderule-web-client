<template>
    <div class="sr-menu-label-wrapper">
        <SrLabelInfoIconButton v-if="label != ''" :label="label" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="insensitive"/>
        <MultiSelect  v-model="selectedMenuItems" :options="props.menuOptions" optionLabel="name" :placeholder="props.label" class="sr-multi-selector" :disabled="props.insensitive" /> 
    </div>
</template>  

<script setup lang="ts">
    import { ref, onMounted, watch } from 'vue';
    import MultiSelect from 'primevue/multiselect';
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

    export interface SrMultiSelectNumberItem {
        name: string;
        value: number;
    }

    const props = defineProps({
        label: {
            type: String,
            required: true
        },
        menuOptions: {
            type: Array as () => SrMultiSelectNumberItem[],
            required: true
        },
        default: {
            type: Array as () => SrMultiSelectNumberItem[],
            default: () => []
        },
        value: {
            type: Array as () => SrMultiSelectNumberItem[],
            default: () => []
        },
        names: {
            type: Array as () => string[],
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
    });

    const selectedMenuItems = ref<SrMultiSelectNumberItem[]>(props.default);
    const emit = defineEmits(['update:value']);

    watch(selectedMenuItems, (newValue) => {
        console.log('MultiMenu:', props.label, 'selected:', newValue);
        if (newValue) {
            const values = newValue.map(item => item.value);
            emit('update:value', values);
        } else {
            console.error(`Watch: ${props.label} No selected items?`);
        }
        console.log(`${props.label} Selected Items: `, selectedMenuItems.value);
    });

    onMounted(() => {
        console.log('Mounted Menu:', props.label);
        selectedMenuItems.value = props.default;
        if (selectedMenuItems.value) {
            const values = selectedMenuItems.value.map(item => item.value);
            emit('update:value', values);
            console.log('onMounted:', props.label, 'values:', values, 'Selected Items:', selectedMenuItems.value);
        } else {
            console.error(`onMounted: ${props.label} No selected items?`);
        }
    });
</script>

<style scoped>


.sr-menu-label-wrapper {
    display: flex; /* This enables Flexbox */
    flex-direction: row;
    justify-content: space-between; /* Aligns children to opposite edges */
    align-items: center; /* This vertically centers the items in the container */
    width: 100%; /* Ensures it spans the full width of its parent */
}

.sr-multi-selector {
    width: 75%;
    padding: 0.125rem ;
    margin:0.25rem;
    background-color: transparent;
}

.p-multiselect-item {
    font-size: small;
}

:deep(.p-multiselect-panel .p-multiselect-items .p-multiselect-item .p-checkbox) {
    width: 0.25rem;
    height: 0.25rem;
}
/* :deep(.p-multiselect) {
    height: 2.0rem;
} */
/*
:deep(.p-multiselect-label-container) {
    height: 1.25rem;
    padding-left:0.25;
} 
*/
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
    flex-direction: column; /* Stack items vertically */ 
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    padding-left:0.25rem;
    font-size: small; 
} 

</style>
