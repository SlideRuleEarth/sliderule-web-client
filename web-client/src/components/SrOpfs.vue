<template>
    <div>
      <h2>Entries</h2>
      <ul>
        <li v-for="(entry, index) in entries" :key="index">
          {{ entry }}
        </li>
      </ul>
      <h2>Keys</h2>
      <ul>
        <li v-for="(key, index) in keys" :key="index">
          {{ key }}
        </li>
      </ul>
      <h2>Values</h2>
      <ul>
        <li v-for="(value, index) in values" :key="index">
          {{ value }}
        </li>
      </ul>
    </div>
  </template>
  
  <script lang="ts">
  import { defineComponent, ref, onMounted } from 'vue';
  
  export default defineComponent({
    name: 'DirectoryHandler',
    setup() {
      const entries = ref<string[]>([]);
      const keys = ref<string[]>([]);
      const values = ref<any[]>([]);

      


        onMounted(async () => {
            // const directoryHandle = await navigator.storage.getDirectory();

            // for await (const [name, handle] of directoryHandle) {
            //     entries.value.push(`${name}: ${handle}`);
            // }
            // for await (const [name, handle] of directoryHandle.entries()) {
            //     entries.value.push(`${name}: ${handle}`);
            // }
            // for await (const handle of directoryHandle.values()) {
            //     values.value.push(handle);
            // }
            // for await (const name of directoryHandle.keys()) {
            //     keys.value.push(name);
            // }
        });
    
        return {
            entries,
            keys,
            values
        };
    }
  });
  </script>
  
  <style scoped>
  /* Add your styles here */
  </style>
  