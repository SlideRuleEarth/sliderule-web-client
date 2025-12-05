import { defineStore } from 'pinia'
import { createLogger } from '@/utils/logger'

const logger = createLogger('GoogleApiKeyStore')

type ValidationStatus = 'unknown' | 'validating' | 'valid' | 'invalid'
type ErrorType =
  | 'referrer_restricted'
  | 'api_disabled'
  | 'forbidden'
  | 'invalid_key'
  | 'unknown'
  | null

export const useGoogleApiKeyStore = defineStore('googleApiKey', {
  state: () => ({
    apiKey: null as string | null,
    validationStatus: 'unknown' as ValidationStatus,
    lastError: null as ErrorType,
    sessionToken: null as string | null,
    sessionExpiry: null as number | null
  }),
  persist: {
    // Use sessionStorage - persists within tab until closed
    storage: sessionStorage,
    // Only persist the API key and session - validation status will be re-checked
    pick: ['apiKey', 'sessionToken', 'sessionExpiry']
  },
  actions: {
    setApiKey(key: string | null) {
      this.apiKey = key
      if (!key) {
        this.validationStatus = 'unknown'
        this.sessionToken = null
        this.sessionExpiry = null
      }
    },
    getApiKey(): string | null {
      return this.apiKey
    },
    clearApiKey() {
      this.apiKey = null
      this.validationStatus = 'unknown'
      this.lastError = null
      this.sessionToken = null
      this.sessionExpiry = null
      logger.debug('API key cleared')
    },
    getLastError(): ErrorType {
      return this.lastError
    },
    hasValidKey(): boolean {
      return this.apiKey !== null && this.validationStatus === 'valid'
    },
    setValidationStatus(status: ValidationStatus) {
      this.validationStatus = status
    },
    getValidationStatus(): ValidationStatus {
      return this.validationStatus
    },
    setSessionToken(token: string, expirySeconds: number) {
      this.sessionToken = token
      // Session tokens are valid for ~24 hours, but we'll refresh earlier
      this.sessionExpiry = Date.now() + expirySeconds * 1000
      logger.debug('Session token set', { expirySeconds })
    },
    getSessionToken(): string | null {
      // Check if session has expired
      if (this.sessionExpiry && Date.now() > this.sessionExpiry) {
        logger.debug('Session token expired, clearing')
        this.sessionToken = null
        this.sessionExpiry = null
        return null
      }
      return this.sessionToken
    },
    isSessionValid(): boolean {
      return (
        this.sessionToken !== null && this.sessionExpiry !== null && Date.now() < this.sessionExpiry
      )
    },
    async validateApiKey(key: string): Promise<boolean> {
      this.validationStatus = 'validating'
      logger.debug('Validating Google API key')

      try {
        // Create a session to validate the API key
        const response = await fetch(`https://tile.googleapis.com/v1/createSession?key=${key}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mapType: 'satellite',
            language: 'en-US',
            region: 'US'
          })
        })

        if (response.ok) {
          const data = await response.json()
          this.apiKey = key
          this.validationStatus = 'valid'
          this.lastError = null
          // Store session token (valid for ~24 hours, we'll use 23 hours to be safe)
          if (data.session) {
            this.setSessionToken(data.session, 23 * 60 * 60)
          }
          logger.debug('API key validated successfully')
          return true
        } else {
          const errorData = await response.json().catch(() => ({}))
          logger.error('API key validation failed', {
            status: response.status,
            error: errorData
          })
          this.validationStatus = 'invalid'

          // Check for specific error types
          const errorMessage = errorData?.error?.message || ''
          if (response.status === 403) {
            if (errorMessage.includes('referer') || errorMessage.includes('referrer')) {
              this.lastError = 'referrer_restricted'
            } else if (errorMessage.includes('API key')) {
              this.lastError = 'api_disabled'
            } else {
              this.lastError = 'forbidden'
            }
          } else if (response.status === 400) {
            this.lastError = 'invalid_key'
          } else {
            this.lastError = 'unknown'
          }

          return false
        }
      } catch (error) {
        logger.error('API key validation error', {
          error: error instanceof Error ? error.message : String(error)
        })
        this.validationStatus = 'invalid'
        return false
      }
    },
    async initializeOnStartup(): Promise<void> {
      // If we have an API key but validation status is unknown (e.g., after page reload),
      // check if we have a valid session before re-validating
      if (this.apiKey && this.validationStatus === 'unknown') {
        if (this.isSessionValid()) {
          // Session still good from storage, just mark as valid
          this.validationStatus = 'valid'
          logger.debug('Restored valid session from storage')
        } else {
          logger.debug('API key found but session expired or missing, re-validating')
          await this.validateApiKey(this.apiKey)
        }
      }
    },
    async refreshSession(): Promise<boolean> {
      if (!this.apiKey) {
        logger.error('Cannot refresh session: no API key')
        return false
      }

      try {
        const response = await fetch(
          `https://tile.googleapis.com/v1/createSession?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              mapType: 'satellite',
              language: 'en-US',
              region: 'US'
            })
          }
        )

        if (response.ok) {
          const data = await response.json()
          if (data.session) {
            this.setSessionToken(data.session, 23 * 60 * 60)
            logger.debug('Session refreshed successfully')
            return true
          }
        }
        logger.error('Failed to refresh session')
        return false
      } catch (error) {
        logger.error('Session refresh error', {
          error: error instanceof Error ? error.message : String(error)
        })
        return false
      }
    }
  }
})
