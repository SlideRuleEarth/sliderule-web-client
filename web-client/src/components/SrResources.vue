<script setup lang="ts">
import { ref } from 'vue';

import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import { useReqParamsStore } from '../stores/reqParamsStore';
// Import any other components or utilities you need
const reqParamsStore = useReqParamsStore();
const newResource = ref('ATL03_20230529000937_10481906_006_02.h5');

const addResource = () => {
  reqParamsStore.addResource(newResource.value);
  newResource.value = ''; // Clear the input after adding
};

const removeResource = (index: number) => {
  reqParamsStore.removeResource(index);
};

</script>
<template>
  <div class="sr-new_resource-container">
    <h3 class="sr-resources-header">Resources</h3>
    <div class="sr-add-resource">
      <InputText v-model="newResource" placeholder="Add a new resource" />
      <Button label="Add" @click="addResource" class="sr-add-resource-button" />
    </div>
    <div class="sr-resources-container">
      <ul class="sr-resources-ul">
        <li v-for="(resource, index) in reqParamsStore.resources" :key="index" class="sr-resource-list-item" >
          <div class="sr-resource-item">
            {{ resource }}
            <Button icon="pi pi-times" @click="reqParamsStore.removeResource(index)" size="small" class="sr-remove-resource-button" />
          </div>
        </li>
      </ul>
    </div>
  </div>

</template>

<style scoped>

.sr-add-resource {
  display: flex; /* Flex layout */
  align-items: center; /* Center vertically */
  margin: 1rem; /* Space below the input */
  height: 2rem;
}
.sr-add-resource-button {
  margin-left: 0.5rem; /* Space between input and button */
  height: 2rem; /* Button height */
}
.sr-remove-resource-button {
  height: 1.5rem; /* Button height */
  width: 1.5rem; /* Button width */
  padding: 0; /* Remove default padding */
  margin-left: 0.5rem; /* Space between text and button */
}
.sr-resources-ul {
  padding: 0; /* Remove default padding */
}
.sr-resource-list-item {
  list-style-type: none; /* Remove default list styling */
}
.sr-resource-item {
  display: flex; /* Flex layout */
  justify-content: space-between; /* Space between text and button */
  align-items: center; /* Center vertically */
  margin-bottom: 0.5rem; /* Space below each item */
  height: 2rem;
}
.sr-new_resource-container {
  display: flex; /* Flex layout */
  flex-direction: column; /* Stack children vertically */
  align-items: center; /* Center vertically */
  margin-top: 0.5rem;
  border: 1px solid var(--p-primary-300); /* Border around the container */
  border-radius: var(--p-border-radius); /* Rounded corners */
}
.sr-resources-container {
  border-radius: var(--p-border-radius); /* Rounded corners */
}
.sr-resources-header {
  color: var(--text-color); /* Text color */
}

</style>
