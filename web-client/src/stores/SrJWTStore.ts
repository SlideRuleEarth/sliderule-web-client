import { defineStore } from 'pinia';
import { useSysConfigStore } from '@/stores/sysConfigStore';

const sysConfigStore = useSysConfigStore();

interface SrJWT {
  accessToken: string;
  refreshToken: string;
  expiration: Date;
}

interface JwtStoreState {
  jwtMap: Record<string, Record<string, SrJWT>>;
}

export const useJwtStore = defineStore('jwtStore', {
  state: (): JwtStoreState => ({
    jwtMap: {},
  }),
  actions: {
    setJwt(domain: string, org: string, jwt: SrJWT) {
      if (!this.jwtMap[domain]) {
        this.jwtMap[domain] = {};
      }
      this.jwtMap[domain][org] = jwt;
    },
    getJwt(domain: string, org: string): SrJWT | null {
      return this.jwtMap[domain]?.[org] || null;
    },
    removeJwt(domain: string, org: string) {
      if (this.jwtMap[domain] && this.jwtMap[domain][org]) {
        delete this.jwtMap[domain][org];
        if (Object.keys(this.jwtMap[domain]).length === 0) {
          delete this.jwtMap[domain];
        }
      }
    },
    clearAllJwts() {
      this.jwtMap = {};
    },
    getCredentials() : SrJWT | null {
        //console.log('getCredentials');
        let jwt: SrJWT | null = null;
        try {
          jwt = this.getJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization());
          if(jwt){
            const nowInUnixTime = Math.floor(Date.now() / 1000);
            const expTime = new Date(jwt.expiration).getTime() / 1000;
            console.log('nowInUnixTime:',nowInUnixTime,' Expiration:', expTime);
            if (expTime < nowInUnixTime) {
              // Show the authentication dialog
              console.log('JWT expired');
              this.removeJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization());
            } else {
              console.log('No authentication needed: JWT is valid');
            }
          } else {
            //console.log('No JWT found');
          }
        } catch (error) {
            console.error('Error during get Num Nodes:', error);
        }
        return jwt;
      },
    


  },
});
