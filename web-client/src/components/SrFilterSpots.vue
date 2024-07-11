<template>
    <div class="sr-menu-multi-input-wrapper">
        <SrLabelInfoIconButton 
            :label="label"  
            :tooltipText="tooltipText" 
            :tooltipUrl="tooltipUrl" 
            :insensitive="insensitive" 
            :labelFontSize="labelFontSize"/>
        <div ref="menuElement" :class="computedMenuClass" >
            <Button 
                label="all" 
                size="small"
                class="sr-menu-select-all-button"
                outlined 
                @click="handleSelectAllItems">
            </Button> 
            <form class="sr-menu-form" name="sr-select-item-form">
                <select 
                    v-model="localSpots" 
                    @input="handleSelectionChange"
                    class="sr-menu-multi-input-select" 
                    name="sr-select-multi-menu" 
                    :id="`srSelectMultiMenu-{{ label }}`" 
                    multiple 
                    :disabled="insensitive"
                >
                    <option 
                        v-for="item in spotsOptions" 
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
    import { spotsOptions } from '@/utils/parmUtils';
    import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
    import Button from 'primevue/button';
    import { readAndUpdateElevationData } from '@/utils/SrParquetUtils';
    import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { at } from 'lodash';

    const atlChartFilterStore = useAtlChartFilterStore();
    const localSpots = ref<number[]>(spotsOptions.map(item => item.value));
    const props = defineProps({ // runtime declaration here
        label: {
            type: String,
            default: 'Spot(s)'
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
        localSpots.value = spotsOptions.map(item => item.value);
        atlChartFilterStore.spots = localSpots.value;
        console.log('handleSelectAllItems atlChartFilterStore.spots:', atlChartFilterStore.spots);
    };
    
    const handleSelectionChange = async (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const newValue = Array.from(target.selectedOptions).map(option => Number(option.value));
        atlChartFilterStore.setScOrient(-1);
        atlChartFilterStore.setBeams([]);
        atlChartFilterStore.setTracks([]);
        atlChartFilterStore.setSpots(newValue);
        await readAndUpdateElevationData(useCurReqSumStore().getReqId());

        console.log('SrFilterSpots handleSelectionChange newValue:', newValue);
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

    const computedMenuClass = computed(() => ({
        'sr-menu-default': true,
        'sr-menu-insensitive': props.insensitive
    }));


    watch(() => atlChartFilterStore.spots, (newSpots, oldSpots) => {
        nextTick(() => {
            console.log('SrFilterSpots watch atlChartFilterStore oldSpots:', oldSpots);
            console.log('SrFilterSpots watch atlChartFilterStore newSpots:', newSpots);
            localSpots.value = newSpots;
        });
    });

</script>

<style scoped>
.sr-menu-multi-input-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 1px solid transparent;
    border-radius: var(--p-border-radius);
    margin-bottom: 1rem;
}

.sr-menu-multi-input-label {
    white-space: nowrap;
    font-size: small;
}

.sr-menu-select-all-button {
    margin: auto;
    padding: 0.5rem;
    height: 1.3rem;
    min-width: 4rem;
    color: var(--p-primary-300);
}

.sr-menu-insensitive {
    color: #888; /* grey color */
}

.sr-menu-default {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items:flex-start;
}

.sr-menu-multi-input-select {
    padding: 0.5rem;
    margin: auto;
    color: white;
    background-color: transparent;
    border-radius: var(--p-border-radius);
    width: auto;
    height: auto; /* Adjust height to fit multiple selections */
    overflow-y:hidden;
    min-height: 7rem;
}

.sr-menu-form {
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
    color: var(--p-primary-300);
}
:deep(.sr-info-button .pi) {
    margin-left: 0rem;
    padding: 0rem;
    padding-left: 0rem;
    height: 0.75rem;
    width: 0.75rem;
    font-size: smaller;
    color: var(--p-primary-300);
}
</style>
