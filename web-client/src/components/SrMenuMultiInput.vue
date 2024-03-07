<template>
    <div class="menu-input-wrapper">
        <div class="menu-row">
            <div ref="menuElement" class="menu-control">
                <label for="srSelectMultiMenu-{{ label }}" class="label">{{ label }}</label>
                <form class="select-item" name="sr-select-item-form">
                    <select v-model="selectedMenuItems" class="select-default" name="sr-select-multi-menu" id="srSelectMultiMenu-{{ label }}" multiple>
                        <option v-for="item in menuOptions" :value="item" :key="item.value">
                            {{ item.value }}
                        </option>
                    </select>
                </form>
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">
    import { ref, onMounted } from 'vue';
    export interface SrMenuItem {
        name:   string;
        value:  string; 
    }
    const props = defineProps({
        label: String,
        menuOptions: Array as () => SrMenuItem[],
        default: Array as () => string[]
    });

    // Update to manage an array of selected items
    const selectedMenuItems = ref<string[]>(props.default || []);

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
