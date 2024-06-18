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
                        v-for="item in props.menuOptions" 
                        :value="item.value" 
                        :key="item.value">
                        {{ item.name }}
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

    const props = defineProps({ // runtime declaration here
        label: String,
        menuOptions: {
            type: Array as () => SrMultiSelectNumberItem[],
            default: () => []
        },
        default: {
            type: Array as () => SrMultiSelectNumberItem[],
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
        }
    });

    const emit = defineEmits(['update:selectAll', 'update:selectedMenuItems']);

    const localSelectAll = ref(false);
    const localSelectedMenuItems = ref([]);

    const handleSelectAllItems = (newValue) => {
        localSelectAll.value = newValue;
        if (newValue) {
            localSelectedMenuItems.value = props.menuOptions.map(item => item.value);
        } else {
            localSelectedMenuItems.value = [];
        }
        console.log('newValue:', newValue, 'localSelectedMenuItems:', localSelectedMenuItems.value);
        emit('update:selectAll', localSelectAll.value);
        emit('update:selectedMenuItems', localSelectedMenuItems.value);
    };

    // Watcher to update selectAll based on selected items
    watch(localSelectedMenuItems, (currentSelection) => {
        console.log('localSelectedMenuItems changed:', currentSelection);
        if(currentSelection){        
            const newSelectAllValue = currentSelection.length === props.menuOptions.length;
            localSelectAll.value = newSelectAllValue;
            emit('update:selectAll', newSelectAllValue);
        } else {
            console.error('No selected items?');
        }
        console.log('localSelectAll:', localSelectAll.value);
    }, { deep: true });

    onMounted(() => {
        console.log('Mounted Menu:', props.label);
        console.log ('props:',props)
        console.log(JSON.stringify(props, null, 2));
        localSelectedMenuItems.value = props.default.map(item => item.value);
        localSelectAll.value = currentSelection.length === props.menuOptions.length;
        console.log('localSelectedMenuItems:', localSelectedMenuItems.value);
        console.log('localSelectAll:', localSelectAll.value);
    });

    const openTooltipUrl = () => {
        console.log('openTooltipUrl:', props.tooltipUrl);
        if (props.tooltipUrl) {
            window.open(props.tooltipUrl, '_blank')?.focus();
        } else {
            console.warn('No tooltip URL provided');
        }
    };

    const menuClass = computed(() => ({
        'sr-menu-multi-input-select-default': true,
        'sr-menu-multi-input-select-insensitive': props.insensitive
    }));

</script>

<style scoped>
.sr-menu-multi-input-wrapper {
    border: 1px solid transparent;
    border-radius: var(--border-radius);
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
    border-radius: var(--border-radius);
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
    color: var(--primary-300);
}
:deep(.sr-info-button .pi) {
    margin-left: 0rem;
    padding: 0rem;
    padding-left: 0rem;
    height: 0.75rem;
    width: 0.75rem;
    font-size: smaller;
    color: var(--primary-300);
}
</style>
