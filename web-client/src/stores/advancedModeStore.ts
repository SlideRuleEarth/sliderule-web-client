import { defineStore } from 'pinia';

export const useAdvancedModeStore = defineStore({
  id: 'advancedModeStore',
  state: () => ({
    advanced: false,
  }),
  actions: {
    toggleAdvanced() {
      this.advanced = !this.advanced;
    },
  },
});