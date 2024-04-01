<template>
    <div class="sr-menu-multi-input-wrapper">
        <label for="srSelectMultiMenu-{{ label }}" class="sr-menu-multi-input-label" :title="tooltipText">{{ label }}</label>
        <!-- Info Icon with Tooltip -->
        <Button v-if="label != ''" icon="pi pi-info-circle" class="p-button-rounded p-button-text p-button-plain sr-info-button " :title="tooltipUrl" @click="openTooltipUrl"></Button>
        <div ref="menuElement" :class="{'sr-menu-multi-input-menu-control':!insensitive, 'sr-menu-multi-input-menu-control-insensitive':insensitive}">
            <SrCheckbox v-model="selectAll" label="All" :default="true" @update:modelValue="handleSelectAllItems"  :insensitive=insensitive />
            <form class="sr-menu-multi-input-select-item" name="sr-select-item-form">
                <select v-model="selectedMenuItems" class="sr-menu-multi-input-select-default" name="sr-select-multi-menu" id="srSelectMultiMenu-{{ label }}" multiple :disabled="insensitive">
                    <option v-for="item in menuOptions" :value="item" :key="item">
                        {{ item }}
                    </option>
                </select>
            </form>
        </div>
    </div>
</template>
  
<script setup lang="ts">
    import { ref, onMounted, watch } from 'vue';
    import SrCheckbox from './SrCheckbox.vue';
    import Button from 'primevue/button';

    const props = defineProps({
        label: String,
        menuOptions: Array as () => string[],
        default: Array as () => string[],
        insensitive: {
            type: Boolean,
            default: false
        },
        tooltipText: {
            type: String,
            default: 'This Some tooltip text here'
        },
        tooltipUrl: {
            type: String,
            default: ''
        },
    });

    const selectAll = ref(true);

    const handleSelectAllItems = (newValue: boolean) => {
        console.log('CheckSelectAll:', newValue);
        selectAll.value = newValue;
        if(props.menuOptions){
            if (selectAll.value) {
                selectedMenuItems.value = [...props.menuOptions];
            } else {
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

    // Watcher to update selectAll based on selected items
    watch(selectedMenuItems, (currentSelection) => {
        console.log('Selected Items:', currentSelection);
        // If the length of selected items is equal to the length of menu options, set selectAll to true, otherwise false
        if (currentSelection && props.menuOptions){
            console.log('Menu Options:', props.menuOptions);
            selectAll.value = currentSelection.length === props.menuOptions.length;
        } else {
            console.error('No menu options to select?');
            selectAll.value = false;
        }
        console.log('Select All:', selectAll.value);
    }, { deep: true });
    const openTooltipUrl = () => {
        console.log('openTooltipUrl:', props.tooltipUrl);
        if (props.tooltipUrl) {
            window.open(props.tooltipUrl, '_blank').focus();
        } else {
            console.warn('No tooltip URL provided');
        }
    };
    onMounted(() => {
        console.log('Mounted Menu:', props.label);
    });
</script>

<style scoped>
.sr-menu-multi-input-wrapper {
    border: 1px solid transparent;
    border-radius: var(--border-radius);
    margin-bottom: 1rem;
}

.sr-menu-multi-input-menu-control {
    display: flex;
    justify-content: start;
    align-items: center;
    width: 90%;
    margin: 0.25rem;
}
.sr-menu-multi-input-label {
    white-space: nowrap;
    font-size: small;
}

.sr-menu-multi-input-select-item {
    display: flex;
    max-width: fit-content;
}

.sr-menu-multi-input-menu-control-insensitive {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    color: #888; /*  grey color */
}

.sr-menu-multi-input-select-default {
    width: calc(100% - 0.25rem);
    padding: 0rem;
    margin: 0rem;
    color: white;
    background-color: transparent;
    border-radius: var(--border-radius);
    height: auto; /* Adjust height to fit multiple selections */
    overflow-y: auto; /* Allows scrolling through options */
}

.sr-menu-multi-input-select-item {
    width: 100%;
    min-width: 4rem;
    height: auto;
    overflow-y: auto;
    padding: 0rem;
    margin: 0rem;
    font-size: small;
}

</style>
