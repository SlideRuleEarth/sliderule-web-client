<template>
    <div class="sr-ancillary-fields-container">
        <div class="sr-ancillary-fields">
            <SrLabelInfoIconButton 
                :label="label" 
                tooltipText="ancillary fields to add to the response dataframe" 
                :tooltipUrl="computedUrl"
                labelFontSize="large"
            />            
            <div class="sr-ancillary-input-row">
                <InputText
                    v-model="newField"
                    :placeholder="placeholder"
                    @keyup.enter="addField"
                />
                <Button
                    icon="pi pi-plus"
                    label="Add"
                    @click="addField"
                    :disabled="!newField.trim()"
                    class="p-button-sm"
                />
            </div>
            <div v-if="modelValue.length > 0" class="sr-ancillary-list">
                <span class="sr-pill" v-for="(field, idx) in modelValue" :key="idx">
                    {{ field }}
                    <Button
                        icon="pi pi-times"
                        class="p-button-text p-button-sm"
                        @click="removeField(idx)"
                    />
                </span>
            </div>
        </div>
    </div> 
</template>

<script setup lang="ts">
import { ref,computed } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

const props = defineProps<{
    modelValue: string[];
    label?: string;
    placeholder?: string;
}>();
const emit = defineEmits<{
    (e: 'update:modelValue', value: string[]): void;
}>();
const computedUrl = computed(() => {
    if(props.label?.includes('atl06')) {
        return `https://slideruleearth.io/web/rtd/user_guide/how_tos/ancillary_fields.html#including-an-ancillary-field-in-an-atl06p-request`;
    } else if (props.label?.includes('atl03 Corr')) {
        return `https://slideruleearth.io/web/rtd/user_guide/how_tos/ancillary_fields.html#including-an-ancillary-field-in-an-atl03sp-request`;
    } else {
        return `https://slideruleearth.io/web/rtd/user_guide/how_tos/ancillary_fields.html#including-ancillary-fields`;
    }
});
const newField = ref('');

function addField() {
    const trimmed = newField.value.trim();
    if (trimmed && !props.modelValue.includes(trimmed)) {
        emit('update:modelValue', [...props.modelValue, trimmed]);
        newField.value = '';
    }
}

function removeField(index: number) {
    const updated = [...props.modelValue];
    updated.splice(index, 1);
    emit('update:modelValue', updated);
}
</script>

<style scoped>
.sr-ancillary-fields-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0rem;
    padding: 0rem;
    margin-bottom: 0;
    border: 1px solid transparent;
    border-radius: var(--p-border-radius);
}
</style>
