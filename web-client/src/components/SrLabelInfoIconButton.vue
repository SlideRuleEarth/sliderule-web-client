<template>
    <div class="sr-label-info-icon-button">
        <label :for="labelFor" :class="{ 'sr-label-info-icon-button-label': !insensitive, 'sr-label-info-icon-button-label-insensitive': insensitive}" :title="tooltipText" :style="{ fontSize: labelFontSize, whitespace: 'no-wrap' }">{{ label }}</label>
        <!-- Info Icon with Tooltip -->
        <Button icon="pi pi-info-circle" class="p-button-rounded p-button-text p-button-plain sr-info-button " :title="tooltipUrl" @click="openTooltipUrl"></Button>
    </div>
</template>

<script setup lang="ts">
    import { onMounted } from 'vue';
    import Button from 'primevue/button';

    const props = defineProps({
        label: String,
        insensitive: {
            type: Boolean,
            default: false
        },
        labelFor: {
            type: String,
            default: ''
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
    });
    const openTooltipUrl = () => {
        console.log('openTooltipUrl:', props.tooltipUrl);
        if (props.tooltipUrl) {
            const newWindow = window.open(props.tooltipUrl, '_blank');
            if (newWindow) {
                newWindow.focus();
            } else {
                console.warn('Failed to open new window');
            }
        } else {
            console.warn('No tooltip URL provided');
        }
    };
    onMounted(() => {
        //console.log('Mounted SrLabelIconInfoButton:', props.label, 'insensitive:', props.insensitive);
    });
</script>

<style scoped>

.sr-label-info-icon-button-label {
    margin-right: 0rem;
    white-space: nowrap;
    font-size: small;
    white-space: nowrap;
    background-color: transparent;
}

.sr-label-info-icon-button-label-insensitive {
    margin-right: 0rem;
    font-size: small;
    color: #888; /*  grey color */
    white-space: nowrap;

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
    border-color: transparent;
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