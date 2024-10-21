import { set, type get } from 'lodash'
import { defineStore } from 'pinia'
export const useSysConfigStore = defineStore('sysConfig', {

    state: () => ({
        domain: "slideruleearth.io",
        organization: "sliderule",        
        verbose: false,
        useDesiredNodes: false, // false means use existing nodes or specify number of nodes
        desired_nodes: 1,
        time_to_live: 720, // minutes
        accessToken: "", 
        refreshToken: "", 
        expiration: 0, 
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
        setVerbose(value: boolean) {
            this.verbose = value
        },
        getVerbose() : boolean {
            return this.verbose
        },
        getTimeToLive() : number {
            return this.time_to_live
        },
        setTimeToLive(value: number) {
            this.time_to_live = value
        },
        setUseDesiredNodes(value: boolean) {
            this.useDesiredNodes = value
        },
        getUseDesiredNodes(): boolean {
            return this.useDesiredNodes
        },
        setDesiredNodes(value: number) {
            this.desired_nodes = value
        },
        getDesiredNodes(): number {
            return this.desired_nodes
        },
        setAccessToken(token: string) {
            this.accessToken = token
        },
        getAccessToken() : string {
            return this.accessToken
        },
        setRefreshToken(token: string) {
            this.refreshToken = token
        },
        getRefreshToken() {
            return this.refreshToken
        },
        setExpiration(expiration: number) {
            this.expiration = expiration
        },
        getExpiration() : number {
            return this.expiration
        },
        orgIsPublic() : boolean {
            return (this.organization === 'sliderule' || this.organization.includes('hackweek'));
        }
    },
})


