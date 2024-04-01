<template>
    <div class="sr-label-info-icon-button">
        <label for="srSelectMenu-{{ label }}" :class="{ 'sr-select-menu-label': !insensitive, 'sr-select-menu-label-insensitive': insensitive}" :title="tooltipText" >{{ label }}</label>
        <!-- Info Icon with Tooltip -->
        <Button v-if="label != ''" icon="pi pi-info-circle" class="p-button-rounded p-button-text p-button-plain sr-info-button " :title="tooltipUrl" @click="openTooltipUrl"></Button>
    </div>
</template>

<script setup lang="ts">
    import { onMounted } from 'vue';
    import Button from 'primevue/button';

    const props = defineProps({
        label: String,
        tooltipText: {
            type: String,
            default: 'This Some tooltip text here'
        },
        tooltipUrl: {
            type: String,
            default: ''
        },
    });
    onMounted(() => {
        console.log('Mounted Menu:', props.label);
    });
</script>

<style scoped>

.sr-select-menu-label {
    margin-right: 0rem;
    white-space: nowrap;
    font-size: small;
}

.sr-select-menu-label-insensitive {
    margin-right: 0.5rem;
    font-size: small;
    color: #888; /*  grey color */
}
.sr-label-info-icon-button {
    display: flex; /* This enables Flexbox */
    justify-content: left; 
    align-items: center; /* This vertically centers the items in the container */
}
:deep(.p-button.p-button-icon-only.p-button-rounded.p-button-text.p-button-plain.sr-info-button) {
    margin-left: 0rem;
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