import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDeployConfigStore = defineStore(
  'deployConfig',
  () => {
    const domain = ref('slideruleearth.io')
    const clusterName = ref('')
    const version = ref('')
    const numberOfNodes = ref(1)

    return {
      domain,
      clusterName,
      version,
      numberOfNodes
    }
  },
  {
    persist: {
      storage: localStorage,
      pick: ['domain', 'clusterName', 'version', 'numberOfNodes']
    }
  }
)
