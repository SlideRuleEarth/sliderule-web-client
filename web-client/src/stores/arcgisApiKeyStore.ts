import { defineStore } from 'pinia'
import { createLogger } from '@/utils/logger'

const logger = createLogger('ArcgisApiKeyStore')

type ValidationStatus = 'unknown' | 'validating' | 'valid' | 'invalid'
type ErrorType =
  | 'referrer_restricted'
  | 'api_disabled'
  | 'forbidden'
  | 'invalid_key'
  | 'unknown'
  | null

export const useArcgisApiKeyStore = defineStore('arcgisApiKey', {
  state: () => ({
    apiKey: null as string | null,
    validationStatus: 'unknown' as ValidationStatus,
    lastError: null as ErrorType
  }),
  persist: {
    // Use localStorage for persistence across browser sessions (not just tabs)
    storage: localStorage,
    // Only persist the API key - validation status will be re-checked
    pick: ['apiKey']
  },
  actions: {
    setApiKey(key: string | null) {
      this.apiKey = key
      if (!key) {
        this.validationStatus = 'unknown'
      }
    },
    getApiKey(): string | null {
      return this.apiKey
    },
    clearApiKey() {
      this.apiKey = null
      this.validationStatus = 'unknown'
      this.lastError = null
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
    async validateApiKey(key: string): Promise<boolean> {
      this.validationStatus = 'validating'
      logger.debug('Validating ArcGIS API key')

      try {
        // Validate by fetching a tile from the World Imagery service
        // Using zoom level 0 tile for minimal data transfer
        const testUrl = `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/0/0/0?token=${key}`

        const response = await fetch(testUrl, {
          method: 'GET'
        })

        if (response.ok) {
          // Check that we got an image back (not an error page)
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('image')) {
            this.apiKey = key
            this.validationStatus = 'valid'
            this.lastError = null
            logger.debug('API key validated successfully')
            return true
          }
        }

        // Handle error cases
        logger.error('API key validation failed', {
          status: response.status
        })
        this.validationStatus = 'invalid'

        // Check for specific error types
        if (response.status === 403) {
          const text = await response.text()
          if (text.includes('referer') || text.includes('referrer')) {
            this.lastError = 'referrer_restricted'
          } else {
            this.lastError = 'forbidden'
          }
        } else if (response.status === 401 || response.status === 498) {
          this.lastError = 'invalid_key'
        } else {
          this.lastError = 'unknown'
        }

        return false
      } catch (error) {
        logger.error('API key validation error', {
          error: error instanceof Error ? error.message : String(error)
        })
        this.validationStatus = 'invalid'
        this.lastError = 'unknown'
        return false
      }
    },
    async initializeOnStartup(): Promise<void> {
      // If we have an API key but validation status is unknown (e.g., after page reload),
      // automatically re-validate
      if (this.apiKey && this.validationStatus === 'unknown') {
        logger.debug('API key found with unknown status, re-validating')
        await this.validateApiKey(this.apiKey)
      }
    }
  }
})
