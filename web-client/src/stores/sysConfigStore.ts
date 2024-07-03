import { defineStore } from 'pinia'
export const useSysConfigStore = defineStore('sysConfig', {

    state: () => ({
        domain: "testsliderule.org",
        organization: "test-public",        
        protocol: 'https', // Assuming default protocol is https
        verbose: true,
        desired_nodes: undefined, // null use existing nodes or specify number of nodes
        time_to_live: 60,
        timeout: 120000, // milliseconds
      }),
    actions: {
        getDomain() {
            return this.domain
        },
        getOrganization() {
            return this.organization
        },
        getProtocol() {
            return this.protocol
        },
        getVerbose() {
            return this.verbose
        },
        getDesiredNodes() {
            return this.desired_nodes
        },
        getTimeToLive() {
            return this.time_to_live
        },
        getTimeout() {
            return this.timeout
        },
        getSysConfig() {
            //console.log("getSysConfig: ", this.$state);
            return this.$state;
        }
    },
})


