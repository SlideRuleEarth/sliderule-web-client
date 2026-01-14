import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchClusterStatus,
  type ClusterStatusResponse,
  type StackStatus
} from '@/utils/fetchUtils'
import {
  useClusterSelectionStore,
  DEFAULT_STATUS_REFRESH_INTERVAL
} from '@/stores/clusterSelectionStore'
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

/**
 * Stable/terminal states where polling should automatically stop.
 * These states indicate an operation has completed (successfully or with failure).
 */
const STABLE_STACK_STATUSES: StackStatus[] = [
  'CREATE_COMPLETE',
  'UPDATE_COMPLETE',
  'DELETE_COMPLETE',
  'NOT_FOUND',
  'CREATE_FAILED',
  'UPDATE_FAILED',
  'DELETE_FAILED',
  'ROLLBACK_COMPLETE',
  'UPDATE_ROLLBACK_COMPLETE',
  'ROLLBACK_FAILED',
  'UPDATE_ROLLBACK_FAILED'
]

// Use DEFAULT_STATUS_REFRESH_INTERVAL from clusterSelectionStore

/**
 * Pending operation type for intent-based locking.
 * Used to prevent double-clicks while waiting for status to confirm operation started.
 * 'shutdown' is set when auto shutdown timer fires, before status confirms deletion.
 */
export type PendingOperation = 'deploy' | 'destroy' | 'extend' | 'shutdown'

/**
 * Maps pending operations to the status values that confirm they started.
 * When status matches any of these, the pending operation is auto-cleared.
 */
const PENDING_CONFIRMATION_STATUSES: Record<PendingOperation, StackStatus[]> = {
  deploy: ['CREATE_IN_PROGRESS', 'CREATE_COMPLETE', 'CREATE_FAILED'],
  destroy: ['DELETE_IN_PROGRESS', 'DELETE_COMPLETE', 'DELETE_FAILED', 'NOT_FOUND'],
  extend: ['UPDATE_IN_PROGRESS', 'UPDATE_COMPLETE', 'UPDATE_FAILED'],
  shutdown: ['DELETE_IN_PROGRESS', 'DELETE_COMPLETE', 'DELETE_FAILED', 'NOT_FOUND']
}

export const useStackStatusStore = defineStore(
  'stackStatus',
  () => {
    // State: cluster -> ClusterStatusResponse
    const statusCache = ref<Record<string, ClusterStatusResponse | null>>({})
    const loadingClusters = ref<Set<string>>(new Set())
    const errors = ref<Record<string, string | null>>({})

    // Per-cluster refresh intervals (auto-refresh state is in clusterSelectionStore)
    const refreshIntervals = ref<Record<string, number>>({})

    // Pending operations for intent-based locking (in-memory only, not persisted)
    // Prevents double-clicks by tracking user intent until status confirms operation started
    const pendingOperations = ref<Record<string, PendingOperation | null>>({})

    // Per-cluster shutdown timers (in-memory only, not persisted)
    // Each cluster maintains its own independent timer for auto shutdown
    const shutdownTimers = ref<Record<string, number>>({})

    // Per-cluster polling timers for background status updates (in-memory only, not persisted)
    const pollingTimers = ref<Record<string, number>>({})

    /**
     * Start background polling for a cluster's status.
     * Called internally when enableAutoRefresh is called.
     */
    function startPolling(cluster: string): void {
      stopPolling(cluster) // Clear any existing timer

      const interval = refreshIntervals.value[cluster] ?? DEFAULT_STATUS_REFRESH_INTERVAL
      logger.debug('Starting background status polling', { cluster, interval })

      pollingTimers.value[cluster] = window.setInterval(() => {
        void fetchStatus(cluster, true)
      }, interval)
    }

    /**
     * Stop background polling for a cluster.
     * Called internally when disableAutoRefresh is called.
     */
    function stopPolling(cluster: string): void {
      const timer = pollingTimers.value[cluster]
      if (timer) {
        clearInterval(timer)
        delete pollingTimers.value[cluster]
        logger.debug('Stopped background status polling', { cluster })
      }
    }

    /**
     * Stop all polling (e.g., on logout or cleanup).
     */
    function stopAllPolling(): void {
      for (const cluster of Object.keys(pollingTimers.value)) {
        clearInterval(pollingTimers.value[cluster])
      }
      pollingTimers.value = {}
    }

    // enableAutoRefresh and disableAutoRefresh are now in clusterSelectionStore

    /**
     * Check if auto-refresh is enabled for a cluster.
     */
    function isAutoRefreshEnabled(cluster: string): boolean {
      return useClusterSelectionStore().isAutoRefreshEnabledForCluster(cluster)
    }

    /**
     * Get the refresh interval for a cluster.
     */
    function getRefreshInterval(cluster: string): number {
      return refreshIntervals.value[cluster] ?? DEFAULT_STATUS_REFRESH_INTERVAL
    }

    /**
     * Set a pending operation for a cluster (intent-based locking).
     * Call this when user initiates an action, before the API call.
     * The pending state will be auto-cleared when status confirms the operation started.
     */
    function setPendingOperation(cluster: string, operation: PendingOperation): void {
      pendingOperations.value[cluster] = operation
      logger.debug('Set pending operation', { cluster, operation })
    }

    /**
     * Clear a pending operation for a cluster.
     * Call this on API error, or it will be auto-cleared when status confirms.
     */
    function clearPendingOperation(cluster: string): void {
      if (pendingOperations.value[cluster]) {
        logger.debug('Cleared pending operation', {
          cluster,
          operation: pendingOperations.value[cluster]
        })
        pendingOperations.value[cluster] = null
      }
    }

    /**
     * Check if a cluster has a pending operation.
     * Used to disable buttons while waiting for status confirmation.
     */
    function hasPendingOperation(cluster: string): boolean {
      return pendingOperations.value[cluster] != null
    }

    /**
     * Get the pending operation type for a cluster.
     */
    function getPendingOperation(cluster: string): PendingOperation | null {
      return pendingOperations.value[cluster] ?? null
    }

    /**
     * Check if the current status confirms a pending operation started.
     * If so, auto-clear the pending operation.
     */
    function checkAndClearPendingOperation(cluster: string, status: StackStatus): void {
      const pending = pendingOperations.value[cluster]
      if (!pending) return

      const confirmationStatuses = PENDING_CONFIRMATION_STATUSES[pending]
      if (confirmationStatuses.includes(status)) {
        logger.debug('Pending operation confirmed by status', { cluster, pending, status })
        pendingOperations.value[cluster] = null
      }
    }

    /**
     * Schedule a shutdown timer for a cluster.
     * When the timer fires, sets pending 'shutdown' operation and enables auto-refresh.
     * This is called automatically by fetchStatus() when auto_shutdown is present.
     */
    function scheduleShutdownTimer(
      cluster: string,
      autoShutdownTime: string | null | undefined
    ): void {
      // Clear any existing timer for this cluster
      clearShutdownTimer(cluster)

      if (!autoShutdownTime) return

      try {
        const shutdownDate = new Date(autoShutdownTime)
        const now = new Date()
        const msUntilShutdown = shutdownDate.getTime() - now.getTime()

        if (msUntilShutdown > 1000) {
          // Schedule for future
          logger.debug('Scheduling shutdown timer', { cluster, autoShutdownTime, msUntilShutdown })
          shutdownTimers.value[cluster] = window.setTimeout(() => {
            logger.info('Auto shutdown time reached', { cluster })
            setPendingOperation(cluster, 'shutdown')
            // Enable both status and events polling via central coordinator
            void useClusterSelectionStore().enableAutoRefresh(cluster, 'Shutdown time reached')
            // Trigger immediate status fetch
            void fetchStatus(cluster, true)
          }, msUntilShutdown)
        } else {
          // Already passed - set pending and trigger refresh
          logger.debug('Auto shutdown time already passed', { cluster, autoShutdownTime })
          setPendingOperation(cluster, 'shutdown')
          // Enable both status and events polling via central coordinator
          void useClusterSelectionStore().enableAutoRefresh(cluster, 'Shutdown time reached')
          void fetchStatus(cluster, true)
        }
      } catch (e) {
        logger.warn('Failed to parse auto shutdown time', {
          cluster,
          autoShutdownTime,
          error: e instanceof Error ? e.message : String(e)
        })
      }
    }

    /**
     * Clear the shutdown timer for a cluster.
     */
    function clearShutdownTimer(cluster: string): void {
      const timer = shutdownTimers.value[cluster]
      if (timer) {
        clearTimeout(timer)
        delete shutdownTimers.value[cluster]
      }
    }

    /**
     * Clear all shutdown timers (e.g., on logout or cleanup).
     */
    function clearAllShutdownTimers(): void {
      for (const cluster of Object.keys(shutdownTimers.value)) {
        clearTimeout(shutdownTimers.value[cluster])
      }
      shutdownTimers.value = {}
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
        logger.debug('Cluster status fetch result', { cluster, result })
        if (result.success && result.data) {
          if (result.data.status === false) {
            // Check if stack simply doesn't exist (not a real error)
            const exception = result.data.exception ?? ''
            if (exception.includes('Not found')) {
              // Stack not found - create synthetic NOT_FOUND response
              const notFoundResponse: ClusterStatusResponse = {
                status: true,
                stack_name: cluster,
                response: {
                  StackStatus: 'NOT_FOUND'
                }
              }
              statusCache.value[cluster] = notFoundResponse
              errors.value[cluster] = null
              checkAndClearPendingOperation(cluster, 'NOT_FOUND')
              // Clear any shutdown timer since cluster doesn't exist
              clearShutdownTimer(cluster)
              // Auto-stop polling since NOT_FOUND is a stable state
              if (isAutoRefreshEnabled(cluster)) {
                logger.info('Cluster not found, stopping auto-refresh', { cluster })
                void useClusterSelectionStore().disableAutoRefresh(cluster, 'Cluster not found')
              }
              // Update last refresh time for UI
              useClusterSelectionStore().updateLastRefreshTime(cluster)
              logger.info('Cluster stack not found', { cluster })
              return notFoundResponse
            }
            // API returned an actual error (e.g., permission denied)
            errors.value[cluster] = exception || 'Failed to fetch status'
            statusCache.value[cluster] = null
            logger.warn('Cluster status API error', { cluster, exception })
            return null
          }
          statusCache.value[cluster] = result.data
          const stackStatus = result.data.response?.StackStatus as StackStatus
          if (stackStatus) {
            checkAndClearPendingOperation(cluster, stackStatus)
            // Auto-stop polling when cluster reaches stable state
            // But DON'T stop if we're waiting for shutdown and cluster is still running
            const pendingOp = getPendingOperation(cluster)
            const waitingForShutdown =
              pendingOp === 'shutdown' &&
              (stackStatus === 'CREATE_COMPLETE' || stackStatus === 'UPDATE_COMPLETE')

            if (
              STABLE_STACK_STATUSES.includes(stackStatus) &&
              isAutoRefreshEnabled(cluster) &&
              !waitingForShutdown
            ) {
              logger.debug('Cluster reached stable state, stopping auto-refresh', {
                cluster,
                status: stackStatus
              })
              // Use appropriate message based on the final state
              const message =
                stackStatus === 'CREATE_COMPLETE' || stackStatus === 'UPDATE_COMPLETE'
                  ? 'Cluster is now running'
                  : stackStatus === 'DELETE_COMPLETE' || stackStatus === 'NOT_FOUND'
                    ? 'Cluster stopped'
                    : 'Operation complete'
              void useClusterSelectionStore().disableAutoRefresh(cluster, message)
            }
          }
          // Schedule shutdown timer if auto_shutdown is present, otherwise clear any existing timer
          if (result.data.auto_shutdown) {
            scheduleShutdownTimer(cluster, result.data.auto_shutdown)
          } else {
            clearShutdownTimer(cluster)
          }
          // Update last refresh time for UI
          useClusterSelectionStore().updateLastRefreshTime(cluster)
          logger.debug('Fetched cluster status', { cluster, status: stackStatus })
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
      refreshIntervals,
      pendingOperations,
      shutdownTimers,
      pollingTimers,
      startPolling,
      stopPolling,
      isAutoRefreshEnabled,
      getRefreshInterval,
      stopAllPolling,
      setPendingOperation,
      clearPendingOperation,
      hasPendingOperation,
      getPendingOperation,
      scheduleShutdownTimer,
      clearShutdownTimer,
      clearAllShutdownTimers,
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
  },
  {
    persist: {
      storage: localStorage,
      pick: ['statusCache']
    }
  }
)
