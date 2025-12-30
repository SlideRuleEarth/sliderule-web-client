// src/stores/geoCoderStore.ts
import { defineStore } from 'pinia'
import Geocoder from 'ol-geocoder'
import { createLogger } from '@/utils/logger'

const logger = createLogger('geoCoderStore')

export interface ReverseGeocodeResult {
  displayName: string
  success: boolean
}

export const useGeoCoderStore = defineStore('geocoder', {
  state: () => ({
    // @ts-ignore
    geocoder: null as Geocoder | null // Initially, there's no geocoder instance
  }),
  actions: {
    // Method to initialize and set the geocoder instance
    initGeoCoder(options: any) {
      // @ts-ignore
      this.geocoder = new Geocoder('nominatim', options)
    },
    // Method to get the geocoder instance
    getGeoCoder() {
      return this.geocoder
    },
    isInitialized() {
      return this.geocoder !== null
    },
    // Reverse geocode coordinates to address using Photon API
    async reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult> {
      // Validate coordinates
      if (lat === 0 && lon === 0) {
        logger.warn('reverseGeocode Invalid coordinates (0,0)', { lat, lon })
        return { displayName: 'Location unavailable', success: false }
      }

      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        logger.warn('reverseGeocode Coordinates out of range', { lat, lon })
        return { displayName: 'Invalid location coordinates', success: false }
      }

      try {
        // Use Photon reverse geocoding API (same provider as forward geocoding)
        const response = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`, {
          signal: AbortSignal.timeout(5000)
        })

        if (!response.ok) {
          throw new Error(`Geocoding failed with status ${response.status}`)
        }

        const data = await response.json()

        if (data.features && data.features.length > 0) {
          const props = data.features[0].properties
          // Build display name from available properties
          const parts: string[] = []
          if (props.name) parts.push(props.name)
          if (props.street) parts.push(props.street)
          if (props.city) parts.push(props.city)
          if (props.state) parts.push(props.state)
          if (props.country) parts.push(props.country)

          const displayName =
            parts.length > 0 ? parts.join(', ') : `Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`

          logger.debug('reverseGeocode Success', { displayName })
          return { displayName, success: true }
        }

        // No results found
        return {
          displayName: `Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          success: true
        }
      } catch (error) {
        logger.warn('reverseGeocode Failed to fetch location name', {
          error: error instanceof Error ? error.message : String(error),
          lat,
          lon
        })
        return {
          displayName: `Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          success: false
        }
      }
    }
  }
})
