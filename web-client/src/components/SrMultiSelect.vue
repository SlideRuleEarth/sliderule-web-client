<template>
    <div>
        <FloatLabel class="multi-menu-float-label">
            <MultiSelect  v-model="selectedMenuItems" display="chip" :options="props.menuOptions" optionLabel="name" :placeholder="props.label" class="multi-selector" /> 
            <label for="sr-multiselect-{{ label }}">{{ label }} </label> 
        </FloatLabel>
    </div>
</template>  
<script setup lang="ts">
    import { ref, onMounted } from 'vue';
    import MultiSelect from 'primevue/multiselect';
    import FloatLabel from 'primevue/floatlabel';

    export interface SrMultiSelectItem {
        name: string;
        code: string; 
    }
    const props = defineProps({
        label: String,
        menuOptions: Array as () => SrMultiSelectItem[],
        default: Array as () => SrMultiSelectItem[]
    });

    // Update to manage an array of selected items
    const selectedMenuItems = ref();
    onMounted(() => {

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

.multi-selector {
    width: 100%;
}
</style>
