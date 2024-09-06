import type { get } from 'lodash'
import { defineStore } from 'pinia'
export const useSysConfigStore = defineStore('sysConfig', {

    state: () => ({
        domain: "slideruleearth.io",
        organization: "sliderule",        
        protocol: 'https', // Assuming default protocol is https
        useDesiredNodes: false, // false means use existing nodes or specify number of nodes
        desired_nodes: 1,
        time_to_live: 60,
        timeout: 120000, // milliseconds
      }),
    actions: {
        setDomain(value: string) {
            this.domain = value
        },
        getDomain() {
            return this.domain
        },
        setOrganization(value: string) {
            this.organization = value
        },
        getOrganization() {
            return this.organization
        },
        setProtocol(value: string) {
            this.protocol = value
        },
        getProtocol() {
            return this.protocol
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
        },
        setUseDesiredNodes(value: boolean) {
            this.useDesiredNodes = value
        },
        getUseDesiredNodes() {
            return this.useDesiredNodes
        },
        setDesiredNodes(value: number) {
            this.desired_nodes = value
        },
        getDesiredNodes() {
            return this.desired_nodes
        },
    },
})


