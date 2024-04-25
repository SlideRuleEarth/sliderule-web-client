import { defineStore } from 'pinia';

export const useCredsStore = defineStore('creds', {
  state: () => ({
    credsData: null,
  }),
  actions: {
    setCredsData(data: any) {
      this.credsData = data;
    },
  },
});