<template>
  <div class="sr-sys-config-container">
    <SrTextInput v-model="sysConfigStore.domain" label="Domain" />
    <SrTextInput v-model="sysConfigStore.organization" label="Organization" />
    <SrMenuInput v-model="sysConfigStore.protocol" :menuOptions="protocolOptions" label="Protocol"/>
    <SrCheckbox v-model="sysConfigStore.verbose" label="Verbose" />
    <SrSwitchedSliderInput 
      v-model="sysConfigStore.desired_nodes"
      :setCheckboxValue="sysConfigStore.setUseDesiredNodes"
      :getCheckboxValue="sysConfigStore.getUseDesiredNodes"
      :setValue="sysConfigStore.setDesiredNodes"
      :getValue="sysConfigStore.getDesiredNodes"
      label="Desired Nodes" 
      :min="1" 
      :max="30" 
      :decimalPlaces="0"
    />
    <SrSliderInput 
      v-model="sysConfigStore.time_to_live" 
      label="Time to Live (secs)" 
      :decimalPlaces="0" 
      :insensitive="!sysConfigStore.getUseDesiredNodes()"
    />
    <SrSliderInput 
      v-model="sysConfigStore.timeout" 
      label="Timeout (ms)" 
      :decimalPlaces="0"
      :insensitive="!sysConfigStore.getUseDesiredNodes()"
    />
  </div>
</template>
  
<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { useSysConfigStore } from '@/stores/sysConfigStore';
  import SrTextInput from '@/components/SrTextInput.vue';
  import SrMenuInput from '@/components/SrMenuInput.vue';
  import SrCheckbox from '@/components/SrCheckbox.vue';
  import SrSwitchedSliderInput from '@/components/SrSwitchedSliderInput.vue';
  import SrSliderInput from './SrSliderInput.vue';

  interface ProtocolOption {
    name: string;
    value: string;
  }
  
  const sysConfigStore = useSysConfigStore();
  onMounted(() => {
    const cfg = sysConfigStore.getSysConfig();
    //console.log('SrSysConfig onMounted cfg:', cfg);
  });

  
  const protocolOptions = ref<ProtocolOption[]>([
    { name: 'https', value: 'https' },
    { name: 'http', value: 'http' }
  ]);
  

</script>
  
<style scoped>
  .sr-sys-config-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
  