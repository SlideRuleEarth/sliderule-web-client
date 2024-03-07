<template>
    <div class="menu-input-wrapper">
        <div class="menu-row">
            <div ref="menuElement" class="menu-control">
                <label for="srSelectMenu-{{ label }}" class="label">{{ label }}</label>
                <form class="select-item" name="sr-select-item-form">
                    <select v-model="selectedMenuItem" class="select-default" name="sr-select-menu" id="srSelectMenu-{{ label }}">
                        <option v-for="item in menuOptions" :value="item.value" :key=item.value>
                            {{ item.value }}
                        </option>
                    </select>
                </form>
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">

    import { onMounted,ref,watch } from 'vue';

    export interface MenuItem {
        name:   string;
        value:  string; 
    }
    const props = defineProps({
        label: String,
        menuOptions: Array as () => MenuItem[],
        initialValue: String
    });
    const selectedMenuItem = ref<string>(props.initialValue? props.initialValue : '');
    const emit = defineEmits(['update:modelValue']);

    watch(selectedMenuItem, (newValue) => {
        console.log('Menu:', props.label, 'selected:', newValue);
        emit('update:modelValue', {value: newValue, name: props.label} );
    });

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
    display: flex; /* This enables Flexbox */
    justify-content: space-between; /* Aligns children to opposite edges */
    align-items: center; /* This vertically centers the items in the container */
    width: 100%; /* Ensures it spans the full width of its parent */
}

.select-default {
    width: auto; /* Adjust width as needed */
    padding: 0.25rem;
    color: white;
    background-color: black;
    border-radius: var(--border-radius);
}
</style>
  