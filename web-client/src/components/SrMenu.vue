<template>
    <div class="sr-menu-input-wrapper">
        <div class="sr-menu-row">
            <div ref="menuElement" :class="{ 'sr-menu-control-center': justify_center, 'sr-menu-control':!justify_center}">
                <SrLabelInfoIconButton :label="label" :labelFontSize="labelFontSize" labelFor="srSelectMenu-{{ label }}" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="insensitive" />
                <form :class="{ 'sr-select-menu-item': !insensitive, 'sr-select-menu-item-insensitive': insensitive }" name="sr-select-item-form">
                    <select v-model="selectedMenuItem" :class="{'sr-select-menu-default':!insensitive,'sr-select-menu-default-insensitive':insensitive }" name="sr-select-menu" id="srSelectMenu-{{ label }}" aria-label="aria-label" :disabled="insensitive">
                        <option v-for="item in menuOptions" :label="item" :value="item" :key=item>
                            {{ item }}
                        </option>
                    </select>
                </form>
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">
    import { onMounted,computed,watch } from 'vue';
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

    const props = defineProps({
        label: String,
        menuOptions: Array as () => string[],
        insensitive: {
            type: Boolean,
            default: false
        },
        defaultOptionIndex: {
            type: Number,
            default: 0
        },
        getSelectedMenuItem: {
            type: Function,
            required: true
        },
        setSelectedMenuItem: {
            type: Function,
            required: true
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
    // Define a computed property that references the getter and setter
    const selectedMenuItem = computed({
        get() {
            const menuItem = props.getSelectedMenuItem();
            //console.log('SrMenu:', props.label, 'get:', menuItem);
            return menuItem; // calling the getter function
        },
        set(value) {
            //console.log('SrMenu:', props.label, 'set:', value)
            props.setSelectedMenuItem(value); // calling the setter function
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
    font-family: var(--p-font-family);
    font-size: small;
}

.sr-select-menu-default-insensitive {
    width: auto;
    padding: 0.25rem;
    color: #888; /*  grey color */
    background-color: transparent;
    border-radius: var(--p-border-radius);
    font-family: var(--p-font-family);
    font-size: small;
}
</style>
  