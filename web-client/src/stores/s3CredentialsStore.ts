import { defineStore } from 'pinia'

// S3 credentials pasted from a /s3access response, used when the user is not logged in
export const useS3CredentialsStore = defineStore('s3Credentials', {
  state: () => ({
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: ''
  }),
  persist: {
    // sessionStorage: secrets are dropped when the tab closes
    storage: sessionStorage
  },
  getters: {
    hasCredentials: (state) => state.accessKeyId !== '' && state.secretAccessKey !== ''
  },
  actions: {
    setCredentials(accessKeyId: string, secretAccessKey: string, sessionToken: string) {
      this.accessKeyId = accessKeyId.trim()
      this.secretAccessKey = secretAccessKey.trim()
      this.sessionToken = sessionToken.trim()
    },
    clearCredentials() {
      this.accessKeyId = ''
      this.secretAccessKey = ''
      this.sessionToken = ''
    }
  }
})
