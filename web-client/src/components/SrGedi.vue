<script setup lang="ts">
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrMultiSelectNumber from './SrMultiSelectNumber.vue'
import SrCheckbox from './SrCheckbox.vue';
import { gediBeamsOptions } from '@/types/SrStaticOptions';


const reqParamsStore = useReqParamsStore();
</script>
<template>
    <SrMultiSelectNumber
        v-model="reqParamsStore.gediBeams"
        label = "Select Beam(s)"
        aria-label="Select Beams"
        :menuOptions="gediBeamsOptions"
        :default="gediBeamsOptions"
    />
    <SrCheckbox
        label="Degrade Flag"
        v-model="reqParamsStore.degradeFlag"
    />
    <SrCheckbox
        label="L2 Quality Flag"
        v-model="reqParamsStore.l2QualityFlag"
    />
    <SrCheckbox
        label="L4 Quality Flag"
        v-model="reqParamsStore.l4QualityFlag"
    />
    <SrCheckbox
        label="Surface Flag"
        v-model="reqParamsStore.surfaceFlag"
    />
</template>