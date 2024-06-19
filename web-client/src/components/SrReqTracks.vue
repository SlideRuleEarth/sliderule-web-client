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
                v-model="reqParamsStore.selectAllTracks" 
                label="All" 
                :default="true" 
                @update:modelValue="handleSelectAllItems"  
                :insensitive=insensitive 
            />
            <form class="sr-menu-multi-input-select-item" name="sr-select-item-form">
                <select 
                    v-model="reqParamsStore.tracks" 
                    @input="handleSelectionChange"
                    class="sr-menu-multi-input-select-default" 
                    name="sr-select-multi-menu" 
                    :id="`srSelectMultiMenu-{{ label }}`" 
                    multiple 
                    :disabled="insensitive"
                >
                    <option 
                        v-for="item in tracksOptions" 
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
    import {  onMounted,computed } from 'vue';
    import SrCheckbox from './SrCheckbox.vue';
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
    import { tracksOptions } from '@/utils/parmUtils';
    import { useReqParamsStore } from '@/stores/reqParamsStore';
    
    const reqParamsStore = useReqParamsStore();

    const props = defineProps({ // runtime declaration here
        label: {
            type: String,
            default: 'Track(s)'
        },
        insensitive: {
            type: Boolean,
            default: false
        },
        tooltipText: {
            type: String,
            default: 'Each track has both a weak and a strong spot'
        },
        tooltipUrl: {
            type: String,
            default: 'https://slideruleearth.io/web/rtd/user_guide/Background.html'
        },
        labelFontSize: {
            type: String,
            default: 'small' // default font size if not passed
        }
    });

    const handleSelectAllItems = (newValue) => {
        if (newValue) {
            reqParamsStore.tracks = tracksOptions.map(item => item.value);
        } else {
            reqParamsStore.tracks = [];
        }
        console.log('newValue:', newValue, ' reqParamsStore.tracks:', reqParamsStore.tracks);
    };

    const handleSelectionChange = (event) => {
        const newValue = Array.from(event.target.selectedOptions).map(option => option.value);
        console.log('handleSelectionChange newValue:', newValue);
        reqParamsStore.selectAllTracks = newValue.length === tracksOptions.length;
    };

    onMounted(() => {
        console.log('Mounted Menu:', props.label);
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
    min-height: 6.5rem;
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
