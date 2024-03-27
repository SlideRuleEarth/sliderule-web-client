<script setup lang="ts">
import SrMenuMultiInput from './SrMultiSelect.vue';
import SrCheckbox from './SrCheckbox.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();

</script>

<template>
    <div class = "sr-atl08-cnf-container">
        <div class="sr-atl08-cnf-header">
            <SrCheckbox
                label="Atl08 Confidence:"
                v-model="reqParamsStore.enableAtl08Confidence"
            />
        </div>
        <SrMenuMultiInput
            v-model="reqParamsStore.landType"
            label = "Land Type(s):"
            aria-label="Select Land Type"
            :menuOptions="reqParamsStore.landTypeOptions"
            :insensitive="!reqParamsStore.enableAtl08Confidence"
            :default="[reqParamsStore.landTypeOptions[0]]"
        />

    </div>
</template>
<style scoped>

.sr-atl08-cnf-header {
  display: flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
}
.sr-atl08-cnf-container {
  margin: 1rem;
  padding: 1rem;
  border: 1px solid var(--primary-300);
  border-radius: var(--border-radius);
}

</style>