<template>
    <div class="sr-label-info-icon-button">
        <label :for="labelFor" 
                :class="{ 'sr-label-info-icon-button-label': !insensitive, 'sr-label-info-icon-button-label-insensitive': insensitive}" 
                :style="{ fontSize: labelFontSize, whiteSpace: 'no-wrap' }"
                @mouseover="tooltipRef.showTooltip($event, tooltipText)"
                @mouseleave="tooltipRef.hideTooltip"
        >
            {{ label }}
        </label>
        <!-- Info Icon with Tooltip -->
        <Button
            v-if="isTooltipUrlProvided" 
            icon="pi pi-info-circle"
            class="p-button-rounded p-button-text p-button-plain sr-info-button " 
            :title="tooltipUrl" 
            @click="openTooltipUrl">
        </Button>
        <SrCustomTooltip ref="tooltipRef"/>
    </div>
</template>

<script setup lang="ts">
    import { onMounted,computed,ref } from 'vue';
    import Button from 'primevue/button';
    import SrCustomTooltip from './SrCustomTooltip.vue';
    const tooltipRef = ref();

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
    const isTooltipUrlProvided = computed(() => props.tooltipUrl && props.tooltipUrl.trim() !== '');
    const openTooltipUrl = () => {
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
    margin-right: 0.25rem;
    white-space: nowrap;
    font-size: small;
    background-color: transparent;
}

.sr-label-info-icon-button-label-insensitive {
    margin-right: 0rem;
    font-size: small;
    color: #888; /*  grey color */
    white-space: nowrap;
    background-color: transparent;
}
.sr-label-info-icon-button {
    display: flex; /* This enables Flexbox */
    justify-content: left; 
    align-items: center; /* This vertically centers the items in the container */
    background-color: transparent;
}
:deep(.p-button.p-button-icon-only.p-button-rounded.p-button-text.p-button-plain.sr-info-button) {
    margin-left: 0rem;
    padding: 0rem;
    height: 1rem;
    width: 1rem;
    color: var(--p-primary-300);
    border-color: transparent;
}
:deep(.sr-info-button .pi) {
    margin-left: 0rem;
    padding: 0rem;
    height: 0.75rem;
    width: 0.75rem;
    font-size: smaller;
    color: var(--p-primary-300);
}

</style>