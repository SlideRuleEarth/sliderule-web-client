<template>
    <div class="sr-swithced-slider-input-wrapper">
        <div class="sr-switched-slider-row">
            <SrCheckbox label=""/>
            <SrSliderInput v-model=innerModelValue :label="props.label" :id="inputID" :min="min"  :max="max" :decimalPlaces="decimalPlaces"/>
        </div>
    </div>
</template>
  
<script setup lang="ts">
    import { ref } from 'vue';
    import SrSliderInput from './SrSliderInput.vue';
    import SrCheckbox from './SrCheckbox.vue';

    const props = defineProps({
        min: {
            type: Number,
            default: 0
        },
        max: {
            type: Number,
            default: 100
        },
        label: {
            type: String,
            default: 'Label'
        },
        decimalPlaces: {
            type: Number,
            default: 0 // Default to 0 decimal places
        }
    });
    const innerModelValue = ref(0.0);
    const inputID = `sr-slider-input-${props.label.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-')}`;

</script>

<style scoped>
.sr-switched-slider-input-wrapper {
    border: 1px solid transparent;
    border-top: 0.0625rem solid var(transparent);
    border-radius: var(--border-radius);
}

.sr-switched-slider-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.125rem ;
}

</style>
  