import { set, type get } from 'lodash'
import { defineStore } from 'pinia'
export const useSysConfigStore = defineStore('sysConfig', {

    state: () => ({
        domain: "slideruleearth.io",
        organization: "sliderule",
        desired_nodes: 1,
        time_to_live: 720, // minutes
        min_nodes: 0,
        max_nodes: 0,
        current_nodes: 0,
        version: "0.0.0",
       }),
    actions: {
        setDomain(value: string) {
            this.domain = value
        },
        getDomain(): string {
            return this.domain
        },
        setOrganization(value: string) {
            this.organization = value
        },
        getOrganization() : string {
            return this.organization
        },
        getTimeToLive() : number {
            return this.time_to_live
        },
        setTimeToLive(value: number) {
            this.time_to_live = value
        },
        setDesiredNodes(value: number) {
            this.desired_nodes = value
        },
        getDesiredNodes(): number {
            return this.desired_nodes
        },
        setMinNodes(value: number) {
            this.min_nodes = value
        },
        getMinNodes(): number {
            return this.min_nodes
        },
        setMaxNodes(value: number) {
            this.max_nodes = value
        },
        getMaxNodes(): number {
            return this.max_nodes
        },
        setCurrentNodes(value: number) {
            this.current_nodes = value
        },
        getCurrentNodes(): number {
            return this.current_nodes
        },
        setVersion(value: string) {
            this.version = value
        },
        getVersion(): string {
            return this.version
        },
    },
})


