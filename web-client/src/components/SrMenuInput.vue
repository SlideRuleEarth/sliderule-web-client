<template>
    <div class="menu-input-wrapper">
        <div class="menu-row">
            <div ref="menuElement" class="menu-control">
                <label class="label">{{ label }}</label>
                <form class="select-item" name="sr-select-item-form">
                    <select v-model="selectedMenuItem" class="select-default" name="sr-select-menu">
                        <option v-for="item in menuOptions" :value="item.value" :key=item.value>
                            {{ item.label }}
                        </option>
                    </select>
                </form>
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">

    import { defineProps, onMounted } from 'vue';
    import { ref } from 'vue';

    export interface MenuItem {
        value: string; 
        label: string;
    }

    const props = defineProps({
        label: String,
        menuOptions: Array as () => MenuItem[],
        default: String
    });
    const selectedMenuItem = ref<string>(props.default? props.default : '');

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

.menu-row, .flex-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.125rem ;
}
.label {
    margin-right: 0.5rem;
}


.input-menu {
    width: 15em; 
    text-align: right;
    padding: 0.25rem;
}

.select-item {
    display: flex;
    align-items: center;
}

.select-default {
    width: auto; /* Adjust width as needed */
    padding: 0.25rem;
}

</style>
  