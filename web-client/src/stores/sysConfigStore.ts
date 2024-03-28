import { defineStore } from 'pinia'
export const useSysConfigStore = defineStore('sysConfig', {

    state: () => ({
        domain: "testsliderule.org",
        organization: "test-public",        
        protocol: 'https', // Assuming default protocol is https
        verbose: true,
        desired_nodes: null, // null use existing nodes or specify number of nodes
        time_to_live: 60,
        timeout: 120000, // milliseconds
      }),
    actions: {
        getSysConfig() {
            return this.$state;
        }
    },
})


