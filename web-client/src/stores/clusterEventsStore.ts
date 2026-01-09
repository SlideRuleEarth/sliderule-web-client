import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchClusterEvents, type StackEvent } from '@/utils/fetchUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('ClusterEventsStore')

/**
 * Cached events data for a cluster.
 */
interface CachedClusterEvents {
  events: StackEvent[]
  fetchedAt: Date
}

export const useClusterEventsStore = defineStore('clusterEvents', () => {
  // State: cluster -> cached events data
  const eventsCache = ref<Record<string, CachedClusterEvents | null>>({})
  const loadingClusters = ref<Set<string>>(new Set())
  const errors = ref<Record<string, string | null>>({})

  /**
   * Fetch events for a cluster, optionally forcing a refresh.
   * On success, caches the events. On failure, returns cached events if available.
   */
  async function fetchEvents(
    cluster: string,
    force = false
  ): Promise<{ events: StackEvent[]; fromCache: boolean; error: string | null }> {
    if (!cluster || cluster.trim() === '') {
      return { events: [], fromCache: false, error: null }
    }

    // Return cached if available and not forcing refresh
    if (!force && eventsCache.value[cluster]) {
      return { events: eventsCache.value[cluster]!.events, fromCache: true, error: null }
    }

    // Skip if already loading
    if (loadingClusters.value.has(cluster)) {
      const cached = eventsCache.value[cluster]
      return {
        events: cached?.events ?? [],
        fromCache: !!cached,
        error: null
      }
    }

    loadingClusters.value.add(cluster)

    try {
      const result = await fetchClusterEvents(cluster)
      logger.debug('Cluster events fetch result', { cluster, result })

      if (result.success && result.data) {
        if (result.data.status === false) {
          // API returned an error (e.g., stack doesn't exist or is down)
          const errorMsg = result.data.exception ?? result.data.error ?? 'Failed to fetch events'
          errors.value[cluster] = errorMsg
          logger.warn('Cluster events API error', { cluster, exception: result.data.exception })

          // Return cached events if available
          const cached = eventsCache.value[cluster]
          if (cached) {
            logger.info('Returning cached events after API error', {
              cluster,
              cachedCount: cached.events.length,
              cachedAt: cached.fetchedAt
            })
            return { events: cached.events, fromCache: true, error: errorMsg }
          }
          return { events: [], fromCache: false, error: errorMsg }
        }

        // Success - cache the events (but preserve existing cache if new events are empty)
        const events = result.data.response ?? []
        const existingCache = eventsCache.value[cluster]

        if (events.length > 0) {
          // Got events - cache them
          eventsCache.value[cluster] = {
            events,
            fetchedAt: new Date()
          }
          errors.value[cluster] = null
          logger.debug('Fetched and cached cluster events', { cluster, count: events.length })
          return { events, fromCache: false, error: null }
        } else if (existingCache && existingCache.events.length > 0) {
          // Got 0 events but have cached events - keep the cache ("sticky" events)
          logger.info('Preserving cached events (API returned 0 events)', {
            cluster,
            cachedCount: existingCache.events.length,
            cachedAt: existingCache.fetchedAt
          })
          errors.value[cluster] = null
          return { events: existingCache.events, fromCache: true, error: null }
        } else {
          // No events and no cached events - cache the empty result
          eventsCache.value[cluster] = {
            events: [],
            fetchedAt: new Date()
          }
          errors.value[cluster] = null
          logger.debug('No events found for cluster', { cluster })
          return { events: [], fromCache: false, error: null }
        }
      } else {
        // Fetch failed (network error, etc.)
        const errorMsg = result.error ?? 'Failed to fetch events'
        errors.value[cluster] = errorMsg
        logger.warn('Failed to fetch cluster events', { cluster, error: result.error })

        // Return cached events if available
        const cached = eventsCache.value[cluster]
        if (cached) {
          logger.info('Returning cached events after fetch failure', {
            cluster,
            cachedCount: cached.events.length,
            cachedAt: cached.fetchedAt
          })
          return { events: cached.events, fromCache: true, error: errorMsg }
        }
        return { events: [], fromCache: false, error: errorMsg }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.value[cluster] = msg
      logger.error('Exception fetching cluster events', { cluster, error: msg })

      // Return cached events if available
      const cached = eventsCache.value[cluster]
      if (cached) {
        return { events: cached.events, fromCache: true, error: msg }
      }
      return { events: [], fromCache: false, error: msg }
    } finally {
      loadingClusters.value.delete(cluster)
    }
  }

  /**
   * Get cached events for a cluster (without fetching).
   */
  function getCachedEvents(cluster: string): CachedClusterEvents | null {
    return eventsCache.value[cluster] ?? null
  }

  /**
   * Check if a cluster's events are currently loading.
   */
  function isLoading(cluster: string): boolean {
    return loadingClusters.value.has(cluster)
  }

  /**
   * Get the last error for a cluster.
   */
  function getError(cluster: string): string | null {
    return errors.value[cluster] ?? null
  }

  /**
   * Clear cache for a specific cluster.
   */
  function invalidate(cluster: string): void {
    delete eventsCache.value[cluster]
    delete errors.value[cluster]
  }

  /**
   * Clear all cached data.
   */
  function invalidateAll(): void {
    eventsCache.value = {}
    errors.value = {}
  }

  return {
    eventsCache,
    loadingClusters,
    errors,
    fetchEvents,
    getCachedEvents,
    isLoading,
    getError,
    invalidate,
    invalidateAll
  }
})
