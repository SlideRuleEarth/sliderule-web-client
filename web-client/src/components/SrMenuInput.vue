<template>
    <div class="sr-menu-input-wrapper">
        <div class="sr-menu-row">
            <div ref="menuElement" :class="{ 'sr-menu-control-center': justify_center, 'sr-menu-control':!justify_center}">
                <SrLabelInfoIconButton :label="label" :labelFontSize="labelFontSize" labelFor="srSelectMenu-{{ label }}" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="insensitive" />
                <form :class="{ 'sr-select-menu-item': !insensitive, 'sr-select-menu-item-insensitive': insensitive }" name="sr-select-item-form">
                    <select v-model="selectedMenuItem" :class="{'sr-select-menu-default':!insensitive,'sr-select-menu-default-insensitive':insensitive }" name="sr-select-menu" id="srSelectMenu-{{ label }}" aria-label="aria-label" :disabled="insensitive">
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
    import { $dt } from '@primevue/themes';
    import { onMounted,ref,watch } from 'vue';
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
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
    const selectedMenuItem = ref<SrMenuItem>(
        props.menuOptions && props.menuOptions.length > 0
            ? props.menuOptions[Number(props.defaultOptionIndex)]
            : { name: 'default', value: 'default' }
    );

    const emit = defineEmits(['update:modelValue']);

    watch(selectedMenuItem, (newValue) => {
        //console.log('Menu:', props.label, 'selected:', newValue);
        emit('update:modelValue', newValue); 
    });

    onMounted(() => {
        //console.log('Mounted Menu:', props.label , 'selected:', selectedMenuItem.value, 'default:', props.defaultOptionIndex);
        const primaryColor = $dt('primary.color');
        const borderRadius = $dt('border.radius');
        const fontFamily = $dt('font.family');
        console.log('Menu:', props.label, 'primaryColor:', primaryColor, 'borderRadius:', borderRadius, 'fontFamily:', fontFamily);
    });
</script>

<style scoped>
.sr-menu-input-wrapper {
    display: flex;
    flex-direction: column;
    border-color: transparent;
    margin-left: 0.5rem;
    width: 100%;
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
.sr-menu-row  {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding-right: 1rem;
    padding-bottom: 0.5rem;
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
    background-color: transparent;
    border-radius: var(--p-border-radius);
    font-family: var(--font-family);
    font-size: small;
}

.sr-select-menu-default-insensitive {
    width: auto;
    padding: 0.25rem;
    color: #888; /*  grey color */
    background-color: transparent;
    border-radius: var(--p-border-radius);
    font-family: var(--font-family);
    font-size: small;
}
</style>
  