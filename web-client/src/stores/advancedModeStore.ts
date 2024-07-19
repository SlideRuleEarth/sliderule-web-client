import { defineStore } from 'pinia';

export const useAdvancedModeStore = defineStore({
  id: 'advancedModeStore',
  state: () => ({
    advanced: false,
  }),
  actions: {
    getAdvanced() {
      return this.advanced;
    },
    setAdvanced(advanced: boolean) {
      this.advanced = advanced;
    },
  }
});