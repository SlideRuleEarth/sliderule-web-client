<template>
    <div class="sr-menu-input-wrapper">
            <div ref="menuElement" :class="{ 'sr-menu-control-center': justify_center, 'sr-menu-control':!justify_center}">
                <SrLabelInfoIconButton :label="label" :labelFontSize="labelFontSize" labelFor="srSelectMenu-{{ label }}" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="insensitive" />
                <form :class="{ 'sr-select-menu-item': !insensitive, 'sr-select-menu-item-insensitive': insensitive }" name="sr-select-item-form" :title="tooltipText">
                    <select 
                        v-model="selectedMenuItem" 
                        :class="{'sr-select-menu-default':!insensitive,'sr-select-menu-default-insensitive':insensitive }" 
                        name="sr-select-menu" 
                        id="srSelectMenu-{{ label }}" 
                        aria-label="aria-label" 
                        :disabled="insensitive" >
                        <option v-for="item in menuOptions" :label="item.label" :value="item" :key=item.value>
                            {{ item.label }}
                        </option>
                    </select>
                </form>
            </div>
    </div>
</template>
  
<script setup lang="ts">
    import { onMounted,computed,watch } from 'vue';
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
    import { SrMenuNumberItem } from '@/stores/atlChartFilterStore';


    const props = defineProps({
        modelValue: Object as () => SrMenuNumberItem,
        label: String,
        menuOptions: Array as () => SrMenuNumberItem[],
        insensitive: {
            type: Boolean,
            default: false
        },
        defaultOptionIndex: {
            type: Number,
            default: 0
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
            default: 'small' // default font size if not passed
        },
    });
    // Use a computed property to bind the `modelValue` prop to `selectedMenuItem`
    const selectedMenuItem = computed({
        get: () => props.modelValue,
        set: (newValue) => {
            emit('update:modelValue', newValue);
        }
    });

    const emit = defineEmits(['update:modelValue']);

    watch(selectedMenuItem, (newValue) => {
        //console.log('Menu:', props.label, 'selected:', newValue);
        emit('update:modelValue', newValue); 
    });

    onMounted(() => {
        //console.log('Mounted Menu:', props.label , 'selected:', selectedMenuItem.value, 'default:', props.defaultOptionIndex);
        // const primaryColor = $dt('primary.color');
        // const borderRadius = $dt('border.radius');
        // const fontFamily = $dt('font.family');
        //console.log('Menu:', props.label, 'primaryColor:', primaryColor, 'borderRadius:', borderRadius, 'fontFamily:', fontFamily);
    });
</script>

<style scoped>
.sr-menu-input-wrapper {
    display: flex;
    flex-direction: column;
    border-color: transparent;
    margin-left: 0.5rem;
}

.sr-select-menu-item {
    display: flex;
    margin-left: 0.25rem;
}
.sr-select-menu-item-insensitive {
    display: flex;
    margin-left: 0.25rem;
    color: #888; /*  grey color */
}
.sr-menu-control-center {
    display: flex; /* This enables Flexbox */
    justify-content: center; /* Aligns children to opposite edges */
    align-items: center; /* This vertically centers the items in the container */
    width: 100%; /* Ensures it spans the full width of its parent */
}

.sr-menu-control {
    display: flex; /* This enables Flexbox */
    justify-content: space-between; /* Aligns children to opposite edges */
    align-items: center; /* This vertically centers the items in the container */
    width: 100%; /* Ensures it spans the full width of its parent */
}
.sr-select-menu-default {
    width: auto;
    padding: 0.25rem;
    color: white;
    background-color: #2c2c2c; /* Set a default dark background */
    border-radius: var(--p-border-radius);
    font-family: var(--p-font-family);
    font-size: small;
}

.sr-select-menu-default-insensitive {
    width: auto;
    padding: 0.25rem;
    color: #888;
    background-color: #1e2b38; /* Slightly different color for insensitive */
    border-radius: var(--p-border-radius);
    font-family: var(--p-font-family);
    font-size: small;
    cursor: not-allowed;
}

/* Add hover effect to improve visibility */
.sr-select-menu-default option:hover {
    background-color: #444444; /* Darker background on hover */
    color: white;
}

</style>
  