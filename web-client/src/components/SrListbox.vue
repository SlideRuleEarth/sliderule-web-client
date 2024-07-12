<template>
    <div class="sr-listbox-wrapper">
        <div :class="{'sr-select-menu-default': !insensitive, 'sr-select-menu-default-insensitive': insensitive }">
            <div :class="{ 'sr-listbox-control-center': justify_center, 'sr-listbox-control': !justify_center }">
                <SrLabelInfoIconButton
                    :label="label"
                    :labelFontSize="labelFontSize"
                    :labelFor="'srSelectMenu-' + label"
                    :tooltipText="tooltipText"
                    :tooltipUrl="tooltipUrl"
                    :insensitive="insensitive"
                />
                <Listbox
                    v-model="selectedMenuItem"
                    :options="menuOptions"
                    :disabled="insensitive"
                    optionLabel="label"
                    :scrollHeight="scrollHeight"
                    multiple
                    :id="'srSelectMenu-' + label"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import Listbox from 'primevue/listbox';
import { watch, onMounted, computed } from 'vue';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
import { SrListNumberItem } from '@/stores/atlChartFilterStore';

const props = defineProps({
    label: {
        type: String,
        default: ''
    },
    menuOptions: {
        type: Array as () => SrListNumberItem[],
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
    justify_center: {
        type: Boolean,
        default: false
    },
    labelFontSize: {
        type: String,
        default: 'small'
    },
    getSelectedMenuItem: {
        type: Function,
        required: true
    },
    setSelectedMenuItem: {
        type: Function,
        required: true
    },
    scrollHeight: {
        type: String,
        default: '7rem'
    }
});

const emit = defineEmits(['update:modelValue']);

// Define a computed property that references the getter and setter
const selectedMenuItem = computed({
    get() {
        console.log('SrListbox:', props.label, 'get:', props.getSelectedMenuItem());
        return props.getSelectedMenuItem(); // calling the getter function
    },
    set(value) {
        console.log('SrListbox:', props.label, 'set:', value)
        props.setSelectedMenuItem(value); // calling the setter function
    }
});

watch(selectedMenuItem, (newValue) => {
    console.log('SrListbox:', props.label, ' Watch selected:', newValue);
    emit('update:modelValue', newValue);
});

// watch(() => props.menuOptions, (newValue) => {
//     console.log('SrListbox:', props.label, 'Watch menuOptions:', newValue);
//     selectedMenuItem.value = newValue;
// });

onMounted(() => {
    console.log('SrListbox:', props.label, 'Mounted menuOptions:', props.menuOptions, ' selected:', selectedMenuItem.value);
    selectedMenuItem.value = props.menuOptions;
});
</script>

<style scoped>

.sr-listbox-wrapper {
    margin-left: 0.5rem;
    width: 100%;
}

.sr-select-menu-default,
.sr-select-menu-default-insensitive {
    width: auto;
    padding: 0.25rem;
    background-color: transparent;
    border-radius: var(--p-border-radius);
    font-family: var(--p-font-family);
    font-size: small;
}

.sr-select-menu-default {
    color: white;
}

.sr-select-menu-default-insensitive {
    color: #888;
}

.sr-listbox-control-center,
.sr-listbox-control {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
    overflow-y: auto;
}

.sr-listbox-control-center {
    justify-content: center;
}

.sr-listbox-control {
    justify-content: space-between;
} 

</style>
