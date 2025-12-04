import { defineStore } from 'pinia'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrJWTStore')
const sysConfigStore = useSysConfigStore()

interface SrJWT {
  accessToken: string
  refreshToken: string
  expiration: Date
}

interface JwtStoreState {
  isPublicMap: Record<string, Record<string, boolean>>
  jwtMap: Record<string, Record<string, SrJWT>>
}

export const useJwtStore = defineStore('jwtStore', {
  state: (): JwtStoreState => ({
    isPublicMap: {},
    jwtMap: {}
  }),
  actions: {
    setIsPublic(domain: string, org: string, isPublic: boolean) {
      if (!this.isPublicMap[domain]) {
        this.isPublicMap[domain] = {}
      }
      this.isPublicMap[domain][org] = isPublic
    },
    getIsPublic(domain: string, org: string): boolean {
      return this.isPublicMap[domain]?.[org] || false
    },
    setJwt(domain: string, org: string, jwt: SrJWT) {
      if (!this.jwtMap[domain]) {
        this.jwtMap[domain] = {}
      }
      this.jwtMap[domain][org] = jwt
    },
    getJwt(domain: string, org: string): SrJWT | null {
      return this.jwtMap[domain]?.[org] || null
    },
    removeJwt(domain: string, org: string) {
      if (this.jwtMap[domain] && this.jwtMap[domain][org]) {
        delete this.jwtMap[domain][org]
        if (Object.keys(this.jwtMap[domain]).length === 0) {
          delete this.jwtMap[domain]
        }
      }
    },
    clearAllJwts() {
      this.jwtMap = {}
    },
    getCredentials(): SrJWT | null {
      //console.log('getCredentials');
      let jwt: SrJWT | null = null
      try {
        jwt = this.getJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization())
        if (jwt) {
          const nowInUnixTime = Math.floor(Date.now() / 1000)
          const expTime = new Date(jwt.expiration).getTime() / 1000
          logger.debug('Checking JWT expiration', { nowInUnixTime, expTime })
          if (expTime < nowInUnixTime) {
            // Show the authentication dialog
            logger.debug('JWT expired')
            this.removeJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization())
          } else {
            logger.debug('No authentication needed: JWT is valid')
          }
        } else {
          //console.log('No JWT found:',jwt);
        }
      } catch (error) {
        logger.error('Error during get Num Nodes', {
          error: error instanceof Error ? error.message : String(error)
        })
      }
      return jwt
    }
  },
  persist: {
    storage: localStorage,
    pick: ['jwtMap', 'isPublicMap']
  }
})
