<template>
    <div class="menu-input-wrapper">
        <div class="menu-row">
            <div ref="menuElement" class="menu-control">
                <label for="srSelectMultiMenu-{{ label }}" class="label">{{ label }}</label>
                <SrCheckbox label="Select All" :default="true" @update:modelValue="handleSelectAllItems" />
                <form class="select-item" name="sr-select-item-form">
                    <select v-model="selectedMenuItems" class="select-default" name="sr-select-multi-menu" id="srSelectMultiMenu-{{ label }}" multiple>
                        <option v-for="item in menuOptions" :value="item" :key="item">
                            {{ item }}
                        </option>
                    </select>
                </form>
            </div>
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

    const handleSelectAllItems = (event) => {
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
.menu-input-wrapper {
    border: 1px solid transparent;
    border-top: 0.125rem solid transparent;
    border-radius: var(--border-radius);
    margin-top: 0.125rem;
}

.label {
    margin-right: 0.5rem;
}

.select-item {
    display: flex;
    align-items: right;
}

.menu-control {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 10px;
}

.select-default {
    width: auto;
    padding: 0.25rem;
    color: white;
    background-color: black;
    border-radius: var(--border-radius);
    /* Additional styles to improve usability of multi-select */
    height: auto; /* Adjust height to fit multiple selections */
    overflow-y: auto; /* Allows scrolling through options */
}
</style>
