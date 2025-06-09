<template>
    <div class="sr-atl24-parms-container">
        <div class="sr-atl24-top-header">
            <SrLabelInfoIconButton
                label="Atl24 Specific Parameters" 
                labelFontSize='larger'
                tooltipText='Atl24 Specific Parameters' 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/dataframe.html#atl24"
            />
        </div>
        <div>
            <SrLabelInfoIconButton
                label="Use"
                >
            </SrLabelInfoIconButton>
            <div class = "sr-parm-row">
                <Checkbox
                    binary
                    v-model="reqParamsStore.useAtl24Compact"
                    size="small"
                />
                <SrCheckbox
                    label="Compact"
                    v-model="reqParamsStore.atl24Compact"
                    :insensitive="!reqParamsStore.useAtl24Compact"
                    labelFontSize="small"
                    :labelOnLeft="true"
                />
            </div>
            <div class = "sr-parm-row">
                <Checkbox
                    binary
                    v-model="reqParamsStore.useAtl24Classification"
                    size="small"
                />
                <SrMultiSelectNumber
                    label="Atl24 Classification"
                    placeholder="Select Atl24 Classification"
                    ariaLabel="Atl24 Classification"
                    :menuOptions="reqParamsStore.atl24ClassOptions"
                    :insensitive="!reqParamsStore.useAtl24Classification"
                    @update:value="reqParamsStore.atl24Classification = $event"
                />
            </div>
            <div class = "sr-parm-row">
                <Checkbox
                    binary
                    v-model="reqParamsStore.useAtl24InvalidKD"
                    size="small"
                />
                <SrCheckbox
                    label="Invalid KD"
                    v-model="reqParamsStore.atl24InvalidKD"
                    :insensitive="!reqParamsStore.useAtl24InvalidKD"
                    labelFontSize="small"
                />
            </div>
            <div class = "sr-parm-row">
                <Checkbox
                    binary
                    v-model="reqParamsStore.useAtl24ConfidenceThreshold"
                    size="small"
                />
                <SrSliderInput
                    label="Confidence Threshold"
                    :min="0"
                    :max="1"
                    :sliderMin="0"
                    :sliderMax="1"
                    step="0.01"
                    inputWidth='4rem'
                    :decimalPlaces="2"
                    :defaultValue="defaultConfidenceThreshold" 
                    v-model="reqParamsStore.atl24ConfidenceThreshold"
                    :insensitive="!reqParamsStore.useAtl24ConfidenceThreshold"
                    labelFontSize="small"
                />
            </div>
            <div class = "sr-parm-row">
                <Checkbox
                    binary
                    v-model="reqParamsStore.useAtl24InvalidWindspeed"
                    size="small"
                />
                <SrCheckbox
                    label="Invalid Windspeed"
                    v-model="reqParamsStore.atl24InvalidWindspeed"
                    :insensitive="!reqParamsStore.useAtl24InvalidWindspeed"
                    labelFontSize="small"
                />
            </div>
            <div class = "sr-parm-row">
                <Checkbox
                    binary
                    v-model="reqParamsStore.useAtl24LowConfidence"
                    size="small"
                />
                <SrCheckbox
                    label="Atl24 Low Confidence"
                    v-model="reqParamsStore.atl24LowConfidence"
                    :insensitive="!reqParamsStore.useAtl24LowConfidence"
                    labelFontSize="small"
                />
            </div>
            <div class = "sr-parm-row">
                <Checkbox
                    binary
                    v-model="reqParamsStore.useAtl24Night"
                    size="small"
                />
                <SrCheckbox
                    label="Atl24 Nighttime"
                    v-model="reqParamsStore.atl24Night"
                    :insensitive="!reqParamsStore.useAtl24Night"
                    labelFontSize="small"
                />
            </div>
            <div class = "sr-parm-row">
                <Checkbox
                    binary
                    v-model="reqParamsStore.useAtl24SensorDepthExceeded"
                    size="small"
                />
                <SrCheckbox
                    label="Atl24 Sensor Depth Exceeded"
                    v-model="reqParamsStore.atl24SensorDepthExceeded"
                    :insensitive="!reqParamsStore.useAtl24SensorDepthExceeded"
                    labelFontSize="small"
                />
            </div>
            <div class="sr-atl24-ancillary-fields">
                <label class="sr-field-label">Add Ancillary Field</label>
                <div class="sr-ancillary-input-row">
                    <InputText
                        v-model="newAncillaryField"
                        placeholder="Enter field name"
                        @keyup.enter="addAncillaryField"
                    />
                    <Button
                        icon="pi pi-plus"
                        label="Add"
                        @click="addAncillaryField"
                        :disabled="!newAncillaryField.trim()"
                        class="p-button-sm"
                    />
                </div>
                <div v-if="reqParamsStore.atl24AncillaryFields.length > 0" class="sr-ancillary-list">
                    <span class="sr-pill" v-for="(field, idx) in reqParamsStore.atl24AncillaryFields" :key="idx">
                        {{ field }}
                        <Button
                            icon="pi pi-times"
                            class="p-button-text p-button-sm"
                            @click="removeAncillaryField(idx)"
                        />
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import SrMultiSelectNumber from '@/components/SrMultiSelectNumber.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrCheckbox from '@/components/SrCheckbox.vue';
import Checkbox from 'primevue/checkbox';
import { ref, computed, onMounted } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
import SrSliderInput from './SrSliderInput.vue';
import { useSlideruleDefaults } from '@/stores/defaultsStore';

const reqParamsStore = useReqParamsStore();
const defaultsStore = useSlideruleDefaults();
const newAncillaryField = ref('');
const defaultConfidenceThreshold = computed(() => {
    return defaultsStore.defaults?.icesat2?.atl24?.confidence_threshold ?? 0;
});
onMounted(async () => {
    if (!defaultsStore.fetched) {
        await defaultsStore.getDefaults();
    }
});

function addAncillaryField() {
    const trimmed = newAncillaryField.value.trim();
    if (
        trimmed &&
        !reqParamsStore.atl24AncillaryFields.includes(trimmed)
    ) {
        reqParamsStore.atl24AncillaryFields.push(trimmed);
        newAncillaryField.value = '';
    }
}

function removeAncillaryField(index: number) {
    reqParamsStore.atl24AncillaryFields.splice(index, 1);
}
</script>

<style scoped>
.sr-atl24-top-header{
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1.5rem;
}
.sr-atl24-parms-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem; /* or whatever spacing you want */
    margin-bottom: 1rem;
    padding: 0.25rem;
}

.sr-atl24-ancillary-fields {
    margin-top: 0.5rem;
}

.sr-parm-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    margin: 0.125rem;
}

.sr-field-label {
    font-size: small;
    font-weight: bold;
    margin: 0.5rem;
    
}

</style>