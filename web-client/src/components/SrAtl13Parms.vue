<template>
    <div class="sr-atl13-parms-container">
        <div class="sr-atl13-top-header">
            <SrLabelInfoIconButton
                label="Atl13 Specific Parameters" 
                labelFontSize='larger'
                tooltipText='Atl13 Specific Parameters' 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/dataframe.html#atl13"
            />
        </div>
        <InputText
            v-model="reqParamsStore.atl13.name"
            class="sr-field-label"
            placeholder="name"
            :aria-label="'name for ATL13'"
            size="small"
        />
        <div class = "sr-parm-row">
            <SrCheckbox
                v-model="reqParamsStore.useAtl13RefId"
                label="Use ATL13 refId"
                size="small"
            />
            <InputNumber
                v-model="reqParamsStore.atl13.refid"
                class="sr-field-label"
                placeholder="refId"
                :aria-label="'refId for ATL13'"
                :disabled="!reqParamsStore.useAtl13RefId"
                size="small"
                :useGrouping="false" 
            />
        </div>
        <div>
            <SrCheckbox
                v-model="reqParamsStore.useAtl13Polygon"
                label="Enable Draw Polygon"
                size="small"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { onMounted } from 'vue';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import SrLabelInfoIconButton from '@/components/SrLabelInfoIconButton.vue';
import { useSlideruleDefaults } from '@/stores/defaultsStore';
import SrCheckbox from '@/components/SrCheckbox.vue';

const reqParamsStore = useReqParamsStore();
const defaultsStore = useSlideruleDefaults();

onMounted(async () => {
    if (!defaultsStore.fetched) {
        await defaultsStore.getDefaults();
    }
});


</script>

<style scoped>
.sr-atl13-top-header{
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1.5rem;
}
.sr-atl13-parms-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem; /* or whatever spacing you want */
    margin-bottom: 1rem;
    padding: 0.25rem;
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