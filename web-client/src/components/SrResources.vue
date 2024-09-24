<script setup lang="ts">
import { ref, computed } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Listbox from 'primevue/listbox';
import { useReqParamsStore } from '@/stores/reqParamsStore';

const reqParamsStore = useReqParamsStore();
const newResource = ref('ATL03_20230529000937_10481906_006_02.h5');

// Computed property to track resources from the store
const resources = computed(() => reqParamsStore.resources);

const addResource = () => {
  if (newResource.value) {
    reqParamsStore.addResource(newResource.value);
    newResource.value = ''; // Clear the input after adding
  }
};

const removeResource = (index: number) => {
  reqParamsStore.removeResource(index);
};

</script>

<template>
  <div class="sr-resources-panel">
    <div class="sr-resources-header">
      <h3>Resources</h3>
    </div>
    <div class="sr-add-resource">
      <InputText v-model="newResource" placeholder="Add a new resource" />
      <Button 
        label="Add" 
        @click="addResource" 
        class="sr-add-resource-button" 
        :disabled="!newResource"  
      />
    </div>
  </div>
  <div class="sr-resources-container">
    <Listbox 
      class="sr-resources-ul" 
      :options="resources"  
      optionLabel="label"
    >
      <template #option="{ option, index }">
        <li class="sr-resource-list-item">
          <div class="sr-resource-item">
            <Button
              icon="pi pi-times"
              @click="removeResource(index)"
              class="sr-remove-resource-button"
            />
            <div class="sr-resource-text">
              <span>{{ option }}</span>
            </div>
          </div>
        </li>
      </template>
    </Listbox>
  </div>

</template>

<style scoped>

.sr-resources-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 0.5rem;
}

.sr-resources-header {
  align-items: center;
  justify-content: center;
  color: var(--p-text-color);
}

.sr-add-resource {
  display: flex;
  align-items: center;
  margin: 0.25rem;
}

.sr-add-resource-button {
  margin-left: 0.5rem;
  height: 2rem;
}

.sr-resource-text {
  margin-left: 0.5rem;
}

:deep(.sr-remove-resource-button) {
  height: 1.5rem;
  width: 1.5rem;
}

.sr-resources-container {
  display: block;
  margin:0.25rem;
}

:deep(.p-listbox .p-component .sr-resources-ul) {
  padding: 0;
}

:deep(.p-listbox-option) {
  overflow-x: auto;
}

.sr-resource-list-item {
  list-style-type: none;
  margin: 0;
  padding: 0;
} 

.sr-resource-item {
  display: flex;
  flex-direction: row;
  justify-content: left;
  align-items: center;
  margin-bottom: 0.5rem;
  height: 2rem;
  overflow-y: auto;
}

</style>
