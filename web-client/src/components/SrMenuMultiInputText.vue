<template>
    <div class="sr-menu-multi-input-wrapper">
        <SrLabelInfoIconButton 
            :label="label"  
            :tooltipText="tooltipText" 
            :tooltipUrl="tooltipUrl" 
            :insensitive="insensitive" 
            :labelFontSize="labelFontSize"/>
        <div ref="menuElement" :class="menuClass" >
            <SrCheckbox 
                v-model="localSelectAll" 
                label="All" 
                :default="true" 
                @update:modelValue="handleSelectAllItems"  
                :insensitive=insensitive 
            />
            <form class="sr-menu-multi-input-select-item" name="sr-select-item-form">
                <select 
                    v-model="localSelectedMenuItems" 
                    class="sr-menu-multi-input-select-default" 
                    name="sr-select-multi-menu" 
                    :id="`srSelectMultiMenu-{{ label }}`" 
                    multiple 
                    :disabled="insensitive"
                >
                    <option 
                        v-for="item in menuOptions" 
                        :value="item" 
                        :key="item">
                        {{ item }}
                    </option>
                </select>
            </form>
        </div>
    </div>
</template>
  
<script setup lang="ts">
    import { ref, onMounted, watch, computed } from 'vue';
    import SrCheckbox from './SrCheckbox.vue';
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

    const props = defineProps({
        label: String,
            menuOptions: {
            type: Array as () => string[],
            default: () => []
        },
        default: { // TBD use in onMounted?
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
        labelFontSize: {
            type: String,
            default: 'small' // default font size if not passed
        },
        selectAll: {
            type: Boolean,
            default: false
        },
        selectedMenuItems: {
            type: Array as () => string[],
            default: () => []
        }
    });

    const emit = defineEmits(['update:selectAll', 'update:selectedMenuItems']);

    const localSelectAll = ref(props.selectAll);
    const localSelectedMenuItems = ref([...props.selectedMenuItems]);

    const handleSelectAllItems = (newValue: boolean) => {
        localSelectAll.value = newValue;
        if (props.menuOptions) {
            localSelectedMenuItems.value = newValue ? [...props.menuOptions] : [];
        } else {
            localSelectedMenuItems.value = [];
        }
            emit('update:selectAll', localSelectAll.value);
        emit('update:selectedMenuItems', localSelectedMenuItems.value);
    };
    // Watcher to update selectAll based on selected items
    watch(localSelectedMenuItems, (currentSelection) => {
        const newSelectAllValue = currentSelection.length === props.menuOptions.length;
        localSelectAll.value = newSelectAllValue;
        emit('update:selectAll', newSelectAllValue);
        emit('update:selectedMenuItems', currentSelection);
    }, { deep: true });


    onMounted(() => {
        //console.log('Mounted Menu:', props.label);
        localSelectAll.value = props.selectAll;
        localSelectedMenuItems.value = [...props.selectedMenuItems];
    });

    const menuClass = computed(() => ({
        'sr-menu-multi-input-select-default': true,
        'sr-menu-multi-input-select-insensitive': props.insensitive
    }));

</script>

<style scoped>
.sr-menu-multi-input-wrapper {
    border: 1px solid transparent;
    border-radius: var(--p-border-radius);
    margin-bottom: 1rem;
}

.sr-menu-multi-input-label {
    white-space: nowrap;
    font-size: small;
}


.sr-menu-multi-input-select-insensitive {
    color: #888; /* grey color */
}

.sr-menu-multi-input-select-default {
    width: calc(100% - 0.25rem);
    padding: 0rem;
    margin: 0rem;
    color: white;
    background-color: transparent;
    border-radius: var(--p-border-radius);
    height: auto; /* Adjust height to fit multiple selections */
    overflow-y: auto; /* Allows scrolling through options */
}

.sr-menu-multi-input-select-item {
    display: flex;
    max-width: fit-content;
    width: 100%;
    min-width: 4rem;
    height: auto;
    overflow-y: auto;
    padding: 0rem;
    margin: 0rem;
    font-size: small;
}

:deep(.p-button.p-button-icon-only.p-button-rounded.p-button-text.p-button-plain.sr-info-button) {
    margin-left: 0.25rem;
    padding: 0rem;
    height: 1rem;
    width: 1rem;
    color: var(--p-primary-300);
}
:deep(.sr-info-button .pi) {
    margin-left: 0rem;
    padding: 0rem;
    padding-left: 0rem;
    height: 0.75rem;
    width: 0.75rem;
    font-size: smaller;
    color: var(--p-primary-300);
}
</style>
