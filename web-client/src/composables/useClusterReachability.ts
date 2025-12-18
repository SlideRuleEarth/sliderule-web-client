import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { fetchServerVersionInfo } from '@/utils/fetchUtils'

export interface ClusterOption {
  label: string
  value: string
  disabled: boolean
}

export interface UseClusterReachabilityReturn {
  clusterReachability: Ref<Record<string, boolean>>
  checkClusterReachability: (_clusterName: string) => Promise<boolean>
  refreshClusterReachability: () => Promise<void>
  clusterOptionsWithState: ComputedRef<ClusterOption[]>
}

/**
 * Composable for checking and tracking cluster reachability.
 *
 * @param clusters - Reactive ref to the list of cluster names
 * @param domain - Reactive ref to the current domain
 * @returns Object with reachability state and helper functions
 */
export function useClusterReachability(
  clusters: Ref<string[]> | ComputedRef<string[]>,
  domain: Ref<string>
): UseClusterReachabilityReturn {
  const clusterReachability = ref<Record<string, boolean>>({})

  async function checkClusterReachability(clusterName: string): Promise<boolean> {
    const result = await fetchServerVersionInfo(clusterName, domain.value)
    return result.success
  }

  async function refreshClusterReachability(): Promise<void> {
    const clusterList = clusters.value
    const results: Record<string, boolean> = {}
    await Promise.all(
      clusterList.map(async (c) => {
        results[c] = await checkClusterReachability(c)
      })
    )
    clusterReachability.value = results
  }

  const clusterOptionsWithState = computed<ClusterOption[]>(() => {
    return clusters.value.map((c) => ({
      label: c,
      value: c,
      disabled: clusterReachability.value[c] === false
    }))
  })

  return {
    clusterReachability,
    checkClusterReachability,
    refreshClusterReachability,
    clusterOptionsWithState
  }
}
