<script setup lang="ts">
import SrAdvOptSidebar from './SrAdvOptSidebar.vue';
import SrGenUserSidebar from './SrGenUserSidebar.vue';
import SrRunControl from './SrRunControl.vue';
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';

</script>

<template>
    <div class="sr-sidebar">
      <div class="sr-sidebar-header">
        <SrRunControl :includeAdvToggle="true"/>
      </div>
      <div class="sr-sidebar-body">
        <SrAdvOptSidebar v-if="useAdvancedModeStore().getAdvanced()"/>
        <SrGenUserSidebar v-if="!useAdvancedModeStore().getAdvanced()"/>
      </div>
    </div>
  </template>
  
  <style scoped>
  .sr-sidebar {
    display: flex;
    flex-direction: column;
    height: 100vh; /* Ensure the sidebar takes up the full viewport height */
    overflow-y: auto; /* Enables vertical scrolling if content exceeds available space */
    overflow-x: auto; /* Enables horizontal scrolling if content exceeds available space */
  }
  
  .sr-sidebar-header {
    border: transparent;
    flex-shrink: 0; /* Prevents shrinking of the header */
  }
  
  .sr-sidebar-body {
    border: transparent;
    flex-grow: 1; /* Allows the body to take up remaining space */
    overflow-y: auto; /* Enables vertical scrolling if content exceeds available space */
  }
  </style>
  