<template>
  <div class="card">
    <DataTable
      :value="(storeInstance as Record<string, unknown> | null)?.[paramsPropertyName] as any[]"
      :tableStyle="{ minWidth: '50rem' }"
    >
      <Column
        v-for="(col, index) in columns"
        :key="index"
        :field="col.field"
        :header="col.header"
      ></Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Import PiniaStore type from Pinia
import type { Store } from 'pinia'

import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrPiniaDataTable')

const props = defineProps<{
  storeNamePrefix: string // Define the prop for the store name prefix
}>()

let storeInstance: Store | null = null // Define the store instance variable
let Params: unknown // Define a variable to hold the dynamically imported Params interface
const columns = ref<{ field: string; header: string }[]>([])

// Construct the name of the Params interface dynamically based on the store name prefix
const storeNamePrefix = `${props.storeNamePrefix}`
const paramsInterfaceName = storeNamePrefix.charAt(0).toUpperCase() + storeNamePrefix.slice(1)
logger.debug('paramsInterfaceName', { paramsInterfaceName })
// Construct the name of the useStore function dynamically based on the interface name
const useStoreFunctionName = `use${paramsInterfaceName}Store`
logger.debug('useStoreFunctionName', { useStoreFunctionName })
// Construct the name of the params property dynamically based on the interface name
const paramsPropertyName =
  paramsInterfaceName.charAt(0).toLowerCase() + paramsInterfaceName.slice(1)
logger.debug('paramsPropertyName', { paramsPropertyName })

// Dynamically import the store and extract Params interface from the same file
void import(`@/stores/${props.storeNamePrefix}Store.ts`)
  .then((module) => {
    // Check if the use<InterfaceName>Store function is available
    logger.debug('module', { module })
    logger.debug('useStoreFunctionName', { useStoreFunctionName })
    if (module[useStoreFunctionName]) {
      logger.debug('module[useStoreFunctionName]', {
        useStoreFunctionName: module[useStoreFunctionName]
      })
      // Dynamically call the use<InterfaceName>Store function to obtain the store instance
      storeInstance = module[useStoreFunctionName]()
      logger.debug('storeInstance', { storeInstance })
    } else {
      logger.error('Function not available in the store module', { useStoreFunctionName })
    }

    // Extract Params interface from the imported module

    logger.debug('paramsInterfaceName', { paramsInterfaceName })
    Params = module?.[paramsInterfaceName]
    logger.debug('Params', { Params })
    if (storeInstance && Params && typeof Params === 'function') {
      // Dynamically define columns based on the structure of Params
      const keys = Object.keys(new (Params as new () => Record<string, unknown>)()) // Instantiate Params to get its keys
      columns.value = keys.map((key) => ({
        field: key,
        header: key // You can customize header names if needed
      }))
    }
  })
  .catch((error) => {
    logger.error('Failed to load store module', { error, storeNamePrefix: props.storeNamePrefix })
  })
</script>
