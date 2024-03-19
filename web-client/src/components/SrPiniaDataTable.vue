<template>
  <div class="card">
    <DataTable :value="storeInstance?.[paramsPropertyName]" :tableStyle="{ minWidth: '50rem' }">
      <Column v-for="(col, index) in columns" :key="index" :field="col.field" :header="col.header"></Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// Import PiniaStore type from Pinia
import { Store } from 'pinia'; 

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

const props = defineProps<{
  storeNamePrefix: string; // Define the prop for the store name prefix
}>(); 

let storeInstance: Store | null = null; // Define the store instance variable
let Params: any; // Define a variable to hold the dynamically imported Params interface
const columns = ref<{ field: string; header: string }[]>([]);

// Construct the name of the Params interface dynamically based on the store name prefix
const storeNamePrefix = `${props.storeNamePrefix}`;
const paramsInterfaceName = storeNamePrefix.charAt(0).toUpperCase() + storeNamePrefix.slice(1);
console.log('paramsInterfaceName:', paramsInterfaceName);
// Construct the name of the useStore function dynamically based on the interface name
const useStoreFunctionName = `use${paramsInterfaceName}Store`;
console.log('useStoreFunctionName:', useStoreFunctionName);
// Construct the name of the params property dynamically based on the interface name
const paramsPropertyName = paramsInterfaceName.charAt(0).toLowerCase() + paramsInterfaceName.slice(1);
console.log('paramsPropertyName:', paramsPropertyName);

// Dynamically import the store and extract Params interface from the same file
import(`@/stores/${props.storeNamePrefix}Store.ts`)
  .then((module) => {
    // Check if the use<InterfaceName>Store function is available
    console.log('module:', module);
    console.log('useStoreFunctionName:', useStoreFunctionName)
    if (module[useStoreFunctionName]) {
      console.log('module[useStoreFunctionName]:', module[useStoreFunctionName])
      // Dynamically call the use<InterfaceName>Store function to obtain the store instance
      storeInstance = module[useStoreFunctionName]();
      console.log('storeInstance:', storeInstance);
    } else {
      console.error(`Function ${useStoreFunctionName} is not available in the store module.`);
    }

    // Extract Params interface from the imported module

    console.log('paramsInterfaceName:', paramsInterfaceName);
    Params = module?.[paramsInterfaceName];
    console.log('Params:', Params);
    if (storeInstance && Params) {
      // Dynamically define columns based on the structure of Params
      const keys = Object.keys(new Params()); // Instantiate Params to get its keys
      columns.value = keys.map((key) => ({
        field: key,
        header: key // You can customize header names if needed
      }));
    }
  });
</script>
