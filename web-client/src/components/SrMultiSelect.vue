<template>
    <div class="menu-label-wrapper">
        <label for="sr-multiselect-{{ label }}">{{ label }} </label> 
        <MultiSelect  v-model="selectedMenuItems" :options="props.menuOptions" optionLabel="name" :placeholder="props.label" class="multi-selector" /> 
    </div>
</template>  
<script setup lang="ts">
    import { ref, onMounted, watch } from 'vue';
    import MultiSelect from 'primevue/multiselect';

    export interface SrMultiSelectItem {
        name: string;
        value: string; 
    }
    const props = defineProps({
        label: String,
        menuOptions: Array as () => SrMultiSelectItem[],
        default: Array as () => SrMultiSelectItem[],
        value: Array as () => SrMultiSelectItem[],
        names: Array as () => string[]
    });

    // Update to manage an array of selected items
    const selectedMenuItems = ref(props.default);
    const emit = defineEmits(['update:value']);
    watch(selectedMenuItems, (newValue) => {
        console.log('MultiMenu:', props.label, 'selected:', newValue);
        if(newValue){
            const names = newValue.map(item => item.name);
            // Emit event to update parent value
            emit('update:value', names);
        } else {
            console.error(`Watch: ${props.label} No selected items?`);
        }
    
    });

    onMounted(() => {
        selectedMenuItems.value = props.default;
        if(selectedMenuItems.value){
            const names = selectedMenuItems.value.map(item => item.name);
            // Emit event to update parent value
            emit('update:value', names);
        } else {
            console.error(`onMounted: ${props.label} No selected items?`);
        }

        console.log('Mounted MultiMenu:', props.label);
        console.log('Selected:', selectedMenuItems.value);
        console.log('Options:', props.menuOptions);
    });
</script>

<style scoped>


.multi-menu-card {
    display: flex;
    justify-content: center;
}

.multi-menu-float-label {
    margin-top: 2rem;
    width: 100%;
    max-width: 20rem;
}
.menu-label-wrapper {
    display: flex; /* This enables Flexbox */
    justify-content: space-between; /* Aligns children to opposite edges */
    align-items: center; /* This vertically centers the items in the container */
    width: 100%; /* Ensures it spans the full width of its parent */
}

.multi-selector {
    width: 100%;
}
/* 
:deep(.p-multiselect) {
    height: 2.0rem;
}

:deep(.p-multiselect-label-container) {
    height: 1.25rem;
    padding-left:0.25;
}
:deep(.p-multiselect-label) {
    font-size: 1rem;
    border:0;
    margin-top: 0; 
    margin-right: 0; 
    margin-bottom: 0;
    margin-left: 0.25rem;    
} */

</style>
