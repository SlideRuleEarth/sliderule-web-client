<template>
    <div class="sr-menu-multi-input-wrapper">
        <SrLabelInfoIconButton 
            :label="label"  
            :tooltipText="tooltipText" 
            :tooltipUrl="tooltipUrl" 
            :insensitive="insensitive" 
            :labelFontSize="labelFontSize"/>
        <div ref="menuElement" :class="menuClass" >
            <Button 
                label="all" 
                size="small"
                class="sr-menu-select-all-button"
                outlined 
                @click="handleSelectAllItems">
            </Button> 
            <form class="sr-menu-multi-input-select-item" name="sr-select-item-form">
                <select 
                    v-model="localBeams" 
                    @input="handleSelectionChange"
                    class="sr-menu-multi-input-select-default" 
                    name="sr-select-multi-menu" 
                    :id="`srSelectMultiMenu-{{ label }}`" 
                    multiple 
                    :disabled="insensitive"
                >
                    <option 
                        v-for="item in beamsOptions" 
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
    import {  onMounted,computed,ref,watch,nextTick } from 'vue';
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
    import { beamsOptions } from '@/utils/parmUtils';
    import { useAtl06ChartFilterStore } from '@/stores/atl06ChartFilterStore';
    import Button from 'primevue/button';
    import { duckDbReadAndUpdateElevationData } from '@/utils/SrDuckDbUtils';
    import { useCurReqSumStore } from '@/stores/curReqSumStore';

    const atl06ChartFilterStore = useAtl06ChartFilterStore();
    const localBeams = ref<number[]>(beamsOptions.map(item => item.value));
    const props = defineProps({ // runtime declaration here
        label: {
            type: String,
            default: 'Beam(s)'
        },
        insensitive: {
            type: Boolean,
            default: false
        },
        tooltipText: {
            type: String,
            default: 'Weak and strong spots are determined by orientation of the satellite'
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

    function handleSelectAllItems() {
        localBeams.value = beamsOptions.map(item => item.value);
        atl06ChartFilterStore.beams = localBeams.value;
        console.log('handleSelectAllItems atl06ChartFilterStore.beams:', atl06ChartFilterStore.beams);
    };
    
    const handleSelectionChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const newValue = Array.from(target.selectedOptions).map(option => Number(option.value));
        atl06ChartFilterStore.setBeams(newValue)
        atl06ChartFilterStore.setTracksForBeams(newValue);
        duckDbReadAndUpdateElevationData(useCurReqSumStore().getReqId());

        console.log('SrFilterBeams handleSelectionChange newValue:', newValue);
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


    watch(() => atl06ChartFilterStore.beams, (newBeams, oldBeams) => {
        nextTick(() => {
            console.log('SrFilterBeams watch atl06ChartFilterStore oldBeams:', oldBeams);
            console.log('SrFilterBeams watch atl06ChartFilterStore newBeams:', newBeams);
            localBeams.value = newBeams;
        });
    });

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

.sr-menu-select-all-button {
    padding: 0.25rem;
    height: 1.3rem;
    min-width: 100%;
    color: var(--primary-300);
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
