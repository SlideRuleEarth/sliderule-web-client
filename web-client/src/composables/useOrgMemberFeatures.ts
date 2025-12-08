// src/composables/useOrgMemberFeatures.ts
import { computed } from 'vue'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

/**
 * Composable for checking GitHub organization membership and feature access.
 * Use this to gate features that should only be available to SlideRuleEarth
 * organization members.
 */
export function useOrgMemberFeatures() {
  const githubAuthStore = useGitHubAuthStore()

  /**
   * Whether the user is authenticated with GitHub and the auth is still valid
   */
  const isAuthenticated = computed(() => githubAuthStore.hasValidAuth)

  /**
   * Whether the user is a member of the SlideRuleEarth organization
   */
  const isMember = computed(() => githubAuthStore.isMember)

  /**
   * Whether the user is an owner of the SlideRuleEarth organization
   */
  const isOwner = computed(() => githubAuthStore.isOwner)

  /**
   * Whether the user can access member-only features.
   * This requires both valid authentication and organization membership.
   */
  const canAccessMemberFeatures = computed(() => githubAuthStore.canAccessMemberFeatures)

  /**
   * The authenticated GitHub username, or null if not authenticated
   */
  const username = computed(() => githubAuthStore.username)

  /**
   * Check and potentially clear expired auth on component mount.
   * Call this in components that depend on auth state.
   */
  function checkAuthValidity(): boolean {
    return githubAuthStore.checkAuthValidity()
  }

  return {
    isAuthenticated,
    isMember,
    isOwner,
    canAccessMemberFeatures,
    username,
    checkAuthValidity
  }
}
