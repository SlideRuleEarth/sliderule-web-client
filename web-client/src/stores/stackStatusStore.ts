import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchClusterStatus,
  type ClusterStatusResponse,
  type StackStatus
} from '@/utils/fetchUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('StackStatusStore')

/**
 * Status values that indicate a cluster cannot be deployed to.
 * These states mean the cluster is either starting, running, or in transition.
 */
const UNDEPLOYABLE_STACK_STATUSES: StackStatus[] = [
  'CREATE_IN_PROGRESS',
  'CREATE_COMPLETE',
  'UPDATE_IN_PROGRESS',
  'UPDATE_ROLLBACK_IN_PROGRESS',
  'ROLLBACK_IN_PROGRESS',
  'ROLLBACK_COMPLETE',
  'DELETE_IN_PROGRESS'
]

/**
 * Status values that indicate a cluster cannot be destroyed.
 * These states mean the cluster doesn't exist or is in transition.
 */
const UNDESTROYABLE_STACK_STATUSES: StackStatus[] = [
  'CREATE_IN_PROGRESS',
  'UPDATE_IN_PROGRESS',
  'UPDATE_ROLLBACK_IN_PROGRESS',
  'ROLLBACK_IN_PROGRESS',
  'DELETE_IN_PROGRESS',
  'DELETE_COMPLETE',
  'NOT_FOUND'
]

/**
 * Status values that indicate a cluster cannot be updated (e.g., TTL extension).
 * Only running clusters (CREATE_COMPLETE, UPDATE_COMPLETE) can be updated.
 */
const NOT_UPDATABLE_STACK_STATUSES: StackStatus[] = [
  'CREATE_IN_PROGRESS',
  'CREATE_FAILED',
  'UPDATE_IN_PROGRESS',
  'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS',
  'UPDATE_FAILED',
  'UPDATE_ROLLBACK_IN_PROGRESS',
  'UPDATE_ROLLBACK_COMPLETE',
  'UPDATE_ROLLBACK_FAILED',
  'ROLLBACK_IN_PROGRESS',
  'ROLLBACK_COMPLETE',
  'ROLLBACK_FAILED',
  'DELETE_IN_PROGRESS',
  'DELETE_COMPLETE',
  'DELETE_FAILED',
  'NOT_FOUND',
  'UNKNOWN',
  'FAILED'
]

// Default refresh interval for status polling (5 seconds)
const DEFAULT_REFRESH_INTERVAL = 5000

export const useStackStatusStore = defineStore('stackStatus', () => {
  // State: cluster -> ClusterStatusResponse
  const statusCache = ref<Record<string, ClusterStatusResponse | null>>({})
  const loadingClusters = ref<Set<string>>(new Set())
  const errors = ref<Record<string, string | null>>({})

  // Per-cluster auto-refresh settings (disabled by default, enabled after operations)
  const autoRefreshClusters = ref<Record<string, boolean>>({})
  const refreshIntervals = ref<Record<string, number>>({})

  /**
   * Enable auto-refresh for a cluster (called after successful deploy/destroy/extend).
   */
  function enableAutoRefresh(cluster: string, interval: number = DEFAULT_REFRESH_INTERVAL): void {
    autoRefreshClusters.value[cluster] = true
    refreshIntervals.value[cluster] = interval
  }

  /**
   * Disable auto-refresh for a cluster.
   */
  function disableAutoRefresh(cluster: string): void {
    autoRefreshClusters.value[cluster] = false
  }

  /**
   * Check if auto-refresh is enabled for a cluster.
   */
  function isAutoRefreshEnabled(cluster: string): boolean {
    return autoRefreshClusters.value[cluster] ?? false
  }

  /**
   * Get the refresh interval for a cluster.
   */
  function getRefreshInterval(cluster: string): number {
    return refreshIntervals.value[cluster] ?? DEFAULT_REFRESH_INTERVAL
  }

  /**
   * Fetch status for a cluster, optionally forcing a refresh.
   */
  async function fetchStatus(
    cluster: string,
    force = false
  ): Promise<ClusterStatusResponse | null> {
    if (!cluster || cluster.trim() === '') {
      return null
    }

    // Return cached if available and not forcing refresh
    if (!force && statusCache.value[cluster] !== undefined) {
      return statusCache.value[cluster]
    }

    // Skip if already loading
    if (loadingClusters.value.has(cluster)) {
      return statusCache.value[cluster] ?? null
    }

    loadingClusters.value.add(cluster)
    errors.value[cluster] = null

    try {
      const result = await fetchClusterStatus(cluster)

      if (result.success && result.data) {
        if (result.data.status === false) {
          // API returned an error (e.g., permission denied)
          errors.value[cluster] = result.data.exception ?? 'Failed to fetch status'
          statusCache.value[cluster] = null
          logger.warn('Cluster status API error', { cluster, exception: result.data.exception })
          return null
        }
        statusCache.value[cluster] = result.data
        logger.debug('Fetched cluster status', { cluster, status: getStackStatus(cluster) })
        return result.data
      } else {
        errors.value[cluster] = result.error ?? 'Failed to fetch status'
        statusCache.value[cluster] = null
        logger.warn('Failed to fetch cluster status', { cluster, error: result.error })
        return null
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.value[cluster] = msg
      statusCache.value[cluster] = null
      logger.error('Exception fetching cluster status', { cluster, error: msg })
      return null
    } finally {
      loadingClusters.value.delete(cluster)
    }
  }

  /**
   * Get cached status for a cluster.
   */
  function getStatus(cluster: string): ClusterStatusResponse | null {
    return statusCache.value[cluster] ?? null
  }

  /**
   * Get the StackStatus string from cached data.
   */
  function getStackStatus(cluster: string): StackStatus | null {
    const data = statusCache.value[cluster]
    if (!data) return null
    const status = data.response?.StackStatus
    return (status as StackStatus) ?? null
  }

  /**
   * Check if a cluster is loading.
   */
  function isLoading(cluster: string): boolean {
    return loadingClusters.value.has(cluster)
  }

  /**
   * Get error for a cluster.
   */
  function getError(cluster: string): string | null {
    return errors.value[cluster] ?? null
  }

  /**
   * Check if a cluster cannot be deployed to based on its stack status.
   */
  function isClusterUndeployable(cluster: string): boolean {
    const status = getStackStatus(cluster)
    if (!status) return false // Unknown status = allow selection
    return UNDEPLOYABLE_STACK_STATUSES.includes(status)
  }

  /**
   * Check if a cluster cannot be destroyed based on its stack status.
   */
  function isClusterUndestroyable(cluster: string): boolean {
    const status = getStackStatus(cluster)
    if (!status) return true // Unknown status = don't allow destroy
    return UNDESTROYABLE_STACK_STATUSES.includes(status)
  }

  /**
   * Check if a cluster cannot be updated (e.g., TTL extension) based on its stack status.
   */
  function isClusterNotUpdatable(cluster: string): boolean {
    const status = getStackStatus(cluster)
    if (!status) return true // Unknown status = don't allow update
    return NOT_UPDATABLE_STACK_STATUSES.includes(status)
  }

  /**
   * Get a human-readable label for the stack status.
   */
  function getStackStatusLabel(cluster: string): string {
    const status = getStackStatus(cluster)
    switch (status) {
      case 'CREATE_IN_PROGRESS':
        return 'Starting...'
      case 'CREATE_COMPLETE':
      case 'UPDATE_COMPLETE':
        return 'Running'
      case 'CREATE_FAILED':
        return 'Create Failed'
      case 'UPDATE_IN_PROGRESS':
      case 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS':
        return 'Updating...'
      case 'UPDATE_FAILED':
        return 'Update Failed'
      case 'UPDATE_ROLLBACK_IN_PROGRESS':
      case 'ROLLBACK_IN_PROGRESS':
        return 'Rolling Back...'
      case 'UPDATE_ROLLBACK_COMPLETE':
      case 'ROLLBACK_COMPLETE':
        return 'Rolled Back'
      case 'UPDATE_ROLLBACK_FAILED':
      case 'ROLLBACK_FAILED':
        return 'Rollback Failed'
      case 'DELETE_IN_PROGRESS':
        return 'Stopping...'
      case 'DELETE_COMPLETE':
        return 'Stopped'
      case 'DELETE_FAILED':
        return 'Delete Failed'
      case 'NOT_FOUND':
        return 'Not deployed'
      case 'FAILED':
        return 'Failed'
      case 'UNKNOWN':
      default:
        return ''
    }
  }

  /**
   * Clear cache for a specific cluster.
   */
  function invalidate(cluster: string): void {
    delete statusCache.value[cluster]
    delete errors.value[cluster]
  }

  /**
   * Clear all cached data.
   */
  function invalidateAll(): void {
    statusCache.value = {}
    errors.value = {}
  }

  return {
    statusCache,
    loadingClusters,
    errors,
    autoRefreshClusters,
    refreshIntervals,
    enableAutoRefresh,
    disableAutoRefresh,
    isAutoRefreshEnabled,
    getRefreshInterval,
    fetchStatus,
    getStatus,
    getStackStatus,
    isLoading,
    getError,
    isClusterUndeployable,
    isClusterUndestroyable,
    isClusterNotUpdatable,
    getStackStatusLabel,
    invalidate,
    invalidateAll
  }
})
