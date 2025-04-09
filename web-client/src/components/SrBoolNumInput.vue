<template>
    <div class="sr-switched-number-input-wrapper">
        <div class="sr-switched-number-labeled-cb">
            <Checkbox v-model="boolValue" :binary="true" label=""  :inputId="label" :disabled="props.insensitive"/>
            <SrLabelInfoIconButton :label="label" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="insensitive"/>
        </div>
        <InputNumber 
            v-model="numValue" 
            label="" 
            :id="inputId" 
            :min="min"  
            :max="max" 
            :minFractionDigits="decimalPlaces" 
            :maxFractionDigits="decimalPlaces" 
            showButtons
            :insensitive="!boolValue || insensitive" 
            :tooltipText="tooltipText"
            size="small"  
        />
    </div>
</template>
  
<script setup lang="ts">
    import { onMounted, ref, type Ref, computed } from 'vue';
    import Checkbox from 'primevue/checkbox';
    import InputNumber from 'primevue/inputnumber';
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

    const props = defineProps<{
        label: string,
        boolRef: Ref<boolean>,
        numRef: Ref<number>,
        min: number,
        max: number,
        checkBoxLabel: string,
        decimalPlaces: number,
        insensitive: boolean,
        tooltipText: string,
        tooltipUrl: string,
    }>();

    const boolValue = computed({
        get: () => props.boolRef.value,
        set: (val: boolean) => (props.boolRef.value = val),
        })

        const numValue = computed({
        get: () => props.numRef.value,
        set: (val: number) => (props.numRef.value = val),
    })

    const inputId = `sr-number-input-${props.label.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-')}`;
    onMounted(() => {
        console.log('Mounted SrSwitchedNumberInput:', props.label, 'insensitive:', props.insensitive); 
    });

</script>

<style scoped>
.sr-switched-number-input-wrapper {
    display: flex;
    flex-direction: column;
    align-items: self-start;
    justify-content: left;
    font-size: small;
    margin: 0rem;
    margin-top: 0.125rem;
}
.sr-switched-number-labeled-cb {
    display: flex;
    align-items: center;
    justify-content: left;
    margin: 0rem;
    margin-bottom: -0.6rem;
    margin-left: -0.125rem;

}
.sr-switched-number-label {
    white-space: nowrap;
    font-size: small;
}
.sr-switched-number-label-insensitive {
    white-space: nowrap;
    color: #888; /*  grey color */
    font-size: small;
}

</style>
  