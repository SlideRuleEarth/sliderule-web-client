<template>
    <div class="sr-menu-input-wrapper">
        <div class="sr-menu-row">
            <div ref="menuElement" class="sr-menu-control">
                <label for="srSelectMenu-{{ label }}" :class="{ 'sr-select-menu-label': !insensitive, 'sr-select-menu-label-insensitive': insensitive}" >{{ label }}</label>
                <form class="sr-select-menu-item" name="sr-select-item-form">
                    <select v-model="selectedMenuItem" class="sr-select-menu-default" name="sr-select-menu" id="srSelectMenu-{{ label }}" aria-label="aria-label" :disabled="insensitive">
                        <option v-for="item in menuOptions" :label="item.name" :value="item" :key=item.value>
                            {{ item.name }}
                        </option>
                    </select>
                </form>
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">

    import { onMounted,ref,watch } from 'vue';

    export interface SrMenuItem {
        name:   string;
        value:  string; 
    }
    const props = defineProps({
        label: String,
        menuOptions: Array as () => SrMenuItem[],
        insensitive: {
            type: Boolean,
            default: false
        },
        defaultOptionIndex: {
            type: String,
            default: "0"
        }
    });
    const selectedMenuItem = ref<SrMenuItem>(
        props.menuOptions && props.menuOptions.length > 0
            ? props.menuOptions[Number(props.defaultOptionIndex)]
            : { name: 'default', value: 'default' }
    );

    const emit = defineEmits(['update:modelValue']);

    watch(selectedMenuItem, (newValue) => {
        console.log('Menu:', props.label, 'selected:', newValue);
        emit('update:modelValue', newValue); 
    });

    onMounted(() => {

        console.log('Mounted Menu:', props.label);
    });
</script>

<style scoped>
.sr-menu-input-wrapper {
    border: 1px solid transparent;
    border-top: 0.125rem solid transparent;
    border-radius: var(--border-radius);
    margin-top: 0.125rem;
}

.sr-select-menu-label {
    margin-right: 0.5rem;
    white-space: nowrap;
    font-size: small;
}

.sr-select-menu-label-insensitive {
    margin-right: 0.5rem;
    font-size: small;
    color: #888; /*  grey color */
}
.sr-select-menu-item {
    display: flex;
    align-items: right;
}
.sr-menu-control {
    display: flex; /* This enables Flexbox */
    justify-content: space-between; /* Aligns children to opposite edges */
    align-items: center; /* This vertically centers the items in the container */
    width: 100%; /* Ensures it spans the full width of its parent */
}

.sr-select-menu-default {
    width: auto; /* Adjust width as needed */
    padding: 0.25rem;
    color: white;
    background-color: transparent;
    border-radius: var(--border-radius);
    font-family: var(--font-family);
    font-size: small;
}
</style>
  