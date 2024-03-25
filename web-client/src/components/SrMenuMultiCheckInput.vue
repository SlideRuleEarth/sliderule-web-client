<template>
    <div class="sr-menu-multi-check-input-wrapper">
            <div ref="menuElement" class="sr-menu-multi-check-input-menu-control">
                <label for="srSelectMultiCheckMenu-{{ label }}" class="sr-menu-multi-check-input-label">{{ label }}</label>
                <SrCheckbox label="Select All" :default="true" @update:modelValue="handleSelectAllItems" />
                <form class="sr-multi-check-menu-select-item" name="sr-select-multicheck-item-form">
                    <select v-model="selectedMenuItems" class="sr-menu-multi-check-input-select-default" name="sr-select-multi-menu" id="srSelectMultiMenu-{{ label }}" multiple>
                        <option v-for="item in menuOptions" :value="item" :key="item">
                            {{ item }}
                            <SrCheckbox label="Select" :default="true" />
                        </option>
                    </select>
                </form>
            </div>
    </div>
</template>
  
<script setup lang="ts">
    import { ref, onMounted } from 'vue';
    import SrCheckbox from './SrCheckbox.vue';

    const props = defineProps({
        label: String,
        menuOptions: Array as () => string[],
        default: Array as () => string[]
    });

    const selectAll = ref(true);

    const handleSelectAllItems = (event:any) => {
        console.log('CheckSelectAll:', event);
        selectAll.value = event;
        if(props.menuOptions){
            if(selectAll.value){
                console.log('Select All:', props.menuOptions);
                selectedMenuItems.value = props.menuOptions.map(item => item);
            } else {
                console.log('Deselect All:', props.menuOptions);
                selectedMenuItems.value = [];
            }
        } else {
            console.error('No menu options to select?');
            selectedMenuItems.value = [];
        }
        console.log('Selected Items:', selectedMenuItems.value);
    };
    // Update to manage an array of selected items
    const selectedMenuItems = ref(props.default);

    onMounted(() => {
        console.log('Mounted Menu:', props.label);
    });
</script>

<style scoped>
.sr-menu-multi-check-input-wrapper {
    border: 1px solid transparent;
    border-top: 0.125rem solid transparent;
    border-radius: var(--border-radius);
    margin-top: 0.125rem;
}

.sr-menu-multi-check-input-label {
    margin-right: 0.5rem;
}

.sr-menu-multi-check-input-select-item {
    display: flex;
    align-items: right;
}

.sr-menu-multi-check-input-menu-control {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 10px;
}

.sr-menu-multi-check-input-select-default {
    width: calc(100% - 0.25rem);
    padding: 0rem;
    margin: 0rem;
    color: white;
    background-color: black;
    border-radius: var(--border-radius);
    height: auto; /* Adjust height to fit multiple selections */
    overflow-y: auto; /* Allows scrolling through options */
}

.sr-multi-check-menu-select-item {
    width: 100%;
    min-width: 10rem;
    height: auto;
    overflow-y: auto;
    padding: 0rem;
    margin: 0rem;
}

</style>
