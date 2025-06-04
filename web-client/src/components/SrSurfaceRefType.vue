<template>
    <div class="sr-menu-label-wrapper">
        <SrLabelInfoIconButton
            :label="label"
            :insensitive="insensitive"
        />
        <MultiSelect  
            v-model="localSurfaceRefType"
            :options="reqParamsStore.surfaceReferenceTypeOptions"
            optionLabel="name"
            optionsValue="value"
            :placeholder="label"
            class="sr-multi-selector"
            :disabled="props.insensitive"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import MultiSelect from 'primevue/multiselect';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';

export interface SrMultiSelectNumberItem {
    name: string;
    value: number;
}

const label = "Surface Reference Type";

const reqParamsStore = useReqParamsStore();

const props = defineProps({
    insensitive: {
        type: Boolean,
        default: false
    },
});

const localSurfaceRefType = computed<SrMultiSelectNumberItem[]>({
    get() {
        return reqParamsStore.surfaceReferenceType;
    },
    // set(newValue) {
    //     const isDynamicSelected = newValue.some(v => v.value === -1);
    //     const cleanValue = (isDynamicSelected && newValue.length > 1)
    //         ? newValue.filter(v => v.value !== -1)
    //         : [...newValue];
    //     if (JSON.stringify(reqParamsStore.surfaceReferenceType) !== JSON.stringify(cleanValue)) {
    //         reqParamsStore.surfaceReferenceType = cleanValue;
    //     }
    // }
    set(newValue) {
        const hasDynamic = newValue.some(v => v.value === -1);
        const hasOthers = newValue.some(v => v.value !== -1);

        let cleanValue: SrMultiSelectNumberItem[];

        if (hasDynamic && hasOthers) {
            // Only keep dynamic if it was the most recent selection
            const lastSelected = newValue[newValue.length - 1];
            cleanValue = lastSelected.value === -1
                ? [lastSelected]
                : newValue.filter(v => v.value !== -1);
        } else {
            cleanValue = [...newValue];
        }

        if (JSON.stringify(reqParamsStore.surfaceReferenceType) !== JSON.stringify(cleanValue)) {
            reqParamsStore.surfaceReferenceType = cleanValue;
        }
    }

});

onMounted(async () => {
    reqParamsStore.surfaceReferenceType = [reqParamsStore.surfaceReferenceTypeOptions[0]];
});
</script>

<style scoped>
.sr-menu-label-wrapper {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.sr-multi-selector {
    width: 75%;
    padding: 0.125rem;
    margin: 0.25rem;
    background-color: transparent;
}

.p-multiselect-item {
    font-size: small;
}

:deep(.p-multiselect-panel .p-multiselect-items .p-multiselect-item .p-checkbox) {
    width: 0.25rem;
    height: 0.25rem;
}

:deep(.p-multiselect .p-multiselect-trigger) {
    width: 0.75rem;
    height: 0.75rem;
    align-self: center;
}

:deep(.p-multiselect .p-multiselect-trigger .p-icon) {
    width: 0.65rem;
    height: 0.65rem;
}

:deep(.p-multiselect .p-multiselect-label) {
    display: flex;
    flex-direction: column;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    padding-left: 0.25rem;
    font-size: small;
}
</style>
