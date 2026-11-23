<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import ConfirmDialog from 'primevue/confirmdialog'
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useSrToastStore } from '@/stores/srToastStore'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useStackStatusStore } from '@/stores/stackStatusStore'
import { useClusterSelectionStore } from '@/stores/clusterSelectionStore'
import { useDeployConfigStore } from '@/stores/deployConfigStore'
import { useHelpStore } from '@/stores/helpStore'
import { useRoute, useRouter } from 'vue-router'
import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
import SrUserUtilsDialog from '@/components/SrUserUtilsDialog.vue'
import SrTokenUtilsDialog from '@/components/SrTokenUtilsDialog.vue'
import { createLogger } from '@/utils/logger'
import { destroyCluster } from '@/utils/fetchUtils'

const logger = createLogger('SrAppBar')

const build_env = import.meta.env.VITE_BUILD_ENV
const banner_text = import.meta.env.VITE_BANNER_TEXT
const banner_color = import.meta.env.VITE_BANNER_COLOR
const sysConfigStore = useSysConfigStore()
const githubAuthStore = useGitHubAuthStore()
const stackStatusStore = useStackStatusStore()
const clusterSelectionStore = useClusterSelectionStore()
const deployConfigStore = useDeployConfigStore()
const helpStore = useHelpStore()
const route = useRoute()
const router = useRouter()
const tooltipRef = ref()
const toast = useToast()
const confirm = useConfirm()
const srToastStore = useSrToastStore()

// Destroy cluster state
const destroying = ref(false)

// Org menu and dialog state
const subDomainMenu = ref<InstanceType<typeof Menu> | null>(null)
const showUserUtilsDialog = ref(false)
const showTokenUtilsDialog = ref(false)

// GitHub auth computed properties
const isGitHubAuthenticated = computed(() => {
  return githubAuthStore.authStatus === 'authenticated' && githubAuthStore.hasValidAuth
})
const isGitHubAuthenticating = computed(() => githubAuthStore.authStatus === 'authenticating')
const githubUsername = computed(() => githubAuthStore.username)
const githubIsMember = computed(() => githubAuthStore.isMember)
const githubIsOwner = computed(() => githubAuthStore.isOwner)
// TODO: Re-enable when GitHub login button is restored
function handleGitHubLogin() {
  void githubAuthStore.initiateLogin()
}

// The tours walk through the map controls, so they only work on the map views
const canTour = computed(() => {
  return route.name === 'home' || route.name === 'request'
})

const helpMenu = ref<InstanceType<typeof Menu> | null>(null)

const helpMenuItems = computed<MenuItem[]>(() => [
  {
    label: 'Quick Tour',
    icon: 'pi pi-bolt',
    disabled: !canTour.value,
    command: () => {
      emit('quick-tour-button-click')
    }
  },
  {
    label: 'Long Tour',
    icon: 'pi pi-compass',
    disabled: !canTour.value,
    command: () => {
      emit('long-tour-button-click')
    }
  },
  { separator: true },
  {
    label: 'Show tips',
    icon: helpStore.showTips ? 'pi pi-check-square' : 'pi pi-stop',
    command: () => {
      helpStore.setShowTips(!helpStore.showTips)
    }
  }
])

const toggleHelpMenu = (event: Event) => {
  helpStore.markHelpOpened()
  helpMenu.value?.toggle(event)
}

const openDocs = () => {
  window.open('https://docs.slideruleearth.io/', '_blank')
}

const openApiSpecs = [
  { label: 'Cluster OpenAPI Specification', page: 'sliderule' },
  { label: 'AMS OpenAPI Specification', page: 'ams' },
  { label: 'ILB OpenAPI Specification', page: 'ilb' },
  { label: 'Authenticator OpenAPI Specification', page: 'authenticator' },
  { label: 'Provisioner OpenAPI Specification', page: 'provisioner' },
  { label: 'Runner OpenAPI Specification', page: 'runner' }
]

const docsMenu = ref<InstanceType<typeof Menu> | null>(null)
const docsMenuItems: MenuItem[] = [
  {
    label: 'SlideRule Earth Documentation',
    icon: 'pi pi-book',
    command: () => {
      window.open('https://docs.slideruleearth.io/', '_blank')
    }
  },
  { separator: true },
  ...openApiSpecs.map(({ label, page }) => ({
    label,
    icon: 'pi pi-code',
    command: () => {
      window.open(`https://docs.slideruleearth.io/openapi/${page}.html`, '_blank')
    }
  }))
]
const toggleDocsMenu = (event: Event) => {
  docsMenu.value?.toggle(event)
}

// User menu for logged-in users
const userMenu = ref<InstanceType<typeof Menu> | null>(null)
const userMenuItems = computed(() => {
  const items = [
    {
      label: 'Server',
      icon: 'pi pi-server',
      command: () => {
        navigateToServer()
      }
    }
  ]

  // Add User Info and Token Utils menu items for org members only
  if (githubIsMember.value || githubIsOwner.value) {
    items.push({
      label: 'User Info',
      icon: 'pi pi-user',
      command: () => {
        showUserUtilsDialog.value = true
      }
    })
    items.push({
      label: 'Token Utils',
      icon: 'pi pi-key',
      command: () => {
        showTokenUtilsDialog.value = true
      }
    })
  }

  items.push({
    label: 'Log Out',
    icon: 'pi pi-sign-out',
    command: () => {
      void handleLogout()
    }
  })

  return items
})

const toggleUserMenu = (event: Event) => {
  userMenu.value?.toggle(event)
}

// Navigate to Server view
function navigateToServer() {
  void router.push('/server')
}

const emit = defineEmits([
  'sliderule-button-click',
  'home-button-click',
  'request-button-click',
  'record-button-click',
  'rectree-button-click',
  'analysis-button-click',
  'settings-button-click',
  'about-button-click',
  'sliderule-buzz-button-click',
  'quick-tour-button-click',
  'long-tour-button-click'
])

const handleHomeButtonClick = () => {
  emit('home-button-click')
}
const handleRequestButtonClick = () => {
  emit('request-button-click')
}
const handleRecTreeButtonClick = () => {
  emit('rectree-button-click')
}
const handleAnalysisButtonClick = () => {
  emit('analysis-button-click')
}
const handleSettingsButtonClick = () => {
  emit('settings-button-click')
}
const handleSlideruleButtonClick = () => {
  emit('sliderule-button-click')
}

const FULL_NODE_COUNT = 7

const slideruleNodesClass = computed(() => {
  if (sysConfigStore.canConnectNodes === 'unknown') return ''
  const nodes = sysConfigStore.current_nodes
  if (sysConfigStore.canConnectNodes === 'no' || nodes <= 0) return 'sr-nodes-none'
  if (nodes < FULL_NODE_COUNT) return 'sr-nodes-low'
  return ''
})

function isThisClean(input: string): boolean {
  // Split the string by dashes
  const parts = input.split('-')
  //console.log('input:', input);
  //console.log('parts:', parts);
  // Check if the string has enough parts to contain a number after the first dash
  if (parts.length < 2) {
    logger.debug('parts.length < 2', { parts })
    return false
  }

  // Check if the number following the dash is zero
  const numberAfterDash = parseInt(parts[1], 10)
  if (numberAfterDash !== 0) {
    //console.log('numberAfterDash !== 0, numberAfterDash:', numberAfterDash);
    return false
  }

  // Check if the string does not end with 'dirty'
  return !input.endsWith('dirty')
}

const testVersionWarning = computed(() => {
  //const tvw = isThisClean(build_env) ? '' : (deviceStore.isMobile? `TEST `:`WebClient Test Version`);
  const tvw = isThisClean(build_env) ? '' : `WebClient Test Version`
  return tvw
})

const showBanner = computed(() => {
  return typeof banner_text === 'string' && banner_text.trim() !== ''
})

const bannerText = computed(() => {
  return banner_text || ''
})

// Optional override; otherwise the banner uses the app bar text color (see .sr-banner-text)
const bannerStyle = computed(() => {
  return typeof banner_color === 'string' && banner_color.trim() !== ''
    ? { color: banner_color.trim() }
    : {}
})

const showSubDomainBadge = computed(() => {
  const org = sysConfigStore.subdomain
  return org && org !== 'sliderule'
})

const subDomainBadgeLabel = computed(() => {
  return sysConfigStore.subdomain
})

const subDomainBadgeSeverity = computed(() => {
  return githubAuthStore.hasValidAuth ? 'info' : 'warn'
})

const subDomainMenuItems = computed(() => {
  const items: Array<{
    label?: string
    icon?: string
    command?: () => void
    separator?: boolean
    disabled?: boolean
  }> = [
    {
      label: 'Log Out',
      icon: 'pi pi-sign-out',
      command: () => {
        void handleLogout()
      }
    },
    {
      separator: true
    },
    {
      label: 'Reset to Public Cluster',
      icon: 'pi pi-refresh',
      command: () => {
        void resetToPublicDomain()
      }
    }
  ]

  // Add Destroy Cluster option if enabled
  if (canDestroyConnectedCluster.value) {
    items.push({
      separator: true
    })
    items.push({
      label: 'Destroy Cluster',
      icon: 'pi pi-trash',
      command: () => {
        handleDestroyCluster()
      }
    })
  }

  return items
})

const toggleSubDomainMenu = (event: Event) => {
  subDomainMenu.value?.toggle(event)
}

async function handleLogout() {
  githubAuthStore.logout()
  await sysConfigStore.resetToPublicDomain()
  toast.add({
    severity: 'info',
    summary: 'Logged Out',
    detail: 'You have been logged out successfully',
    life: srToastStore.getLife()
  })
}

async function resetToPublicDomain() {
  await sysConfigStore.resetToPublicDomain()
  toast.add({
    severity: 'info',
    summary: 'Reset Complete',
    detail: 'Configuration has been reset to defaults',
    life: srToastStore.getLife()
  })
}

// Computed property for destroy button enabled state (uses connected cluster)
const canDestroyConnectedCluster = computed(() => {
  const clusterName = sysConfigStore.cluster
  if (!clusterName || clusterName === 'unknown') return false
  if (stackStatusStore.hasPendingOperation(clusterName)) return false
  if (stackStatusStore.isClusterUndestroyable(clusterName)) return false
  return true
})

async function executeDestroyCluster() {
  const clusterName = sysConfigStore.cluster
  if (!clusterName || clusterName === 'unknown') return

  destroying.value = true
  clusterSelectionStore.setSelectedCluster(clusterName)
  deployConfigStore.clusterName = clusterName
  void clusterSelectionStore.setAutoRefreshEnabled(true)

  try {
    const result = await destroyCluster(clusterName)
    if (result.success) {
      // Success: enable auto-refresh for both status and events via central coordinator
      void clusterSelectionStore.enableAutoRefresh(clusterName, 'Stopping cluster')
      // Force immediate status refresh to get updated state
      void stackStatusStore.fetchStatus(clusterName, true)
      // Reset to public cluster after initiating destroy
      await sysConfigStore.resetToPublicDomain()
      toast.add({
        severity: 'info',
        summary: 'Cluster Destruction Started',
        detail: `Destroying cluster "${clusterName}" and resetting to public cluster`,
        life: srToastStore.getLife()
      })
    } else {
      // Failure: clear pending operation and show error
      stackStatusStore.clearPendingOperation(clusterName)
      const errorMsg = result.error ?? 'Destroy failed'
      toast.add({
        severity: 'error',
        summary: 'Destroy Failed',
        detail: errorMsg,
        life: srToastStore.getLife()
      })
    }
  } catch (e) {
    // Exception: clear pending operation and show error
    const clusterName = sysConfigStore.cluster
    if (clusterName && clusterName !== 'unknown') {
      stackStatusStore.clearPendingOperation(clusterName)
    }
    toast.add({
      severity: 'error',
      summary: 'Destroy Failed',
      detail: e instanceof Error ? e.message : String(e),
      life: srToastStore.getLife()
    })
  } finally {
    destroying.value = false
  }
}

function handleDestroyCluster() {
  const clusterName = sysConfigStore.cluster
  if (!clusterName || clusterName === 'unknown') {
    toast.add({
      severity: 'warn',
      summary: 'No Cluster Connected',
      detail: 'Cannot destroy cluster - no cluster is currently connected',
      life: srToastStore.getLife()
    })
    return
  }
  if (stackStatusStore.hasPendingOperation(clusterName)) {
    toast.add({
      severity: 'warn',
      summary: 'Operation In Progress',
      detail: `Cannot destroy cluster "${clusterName}" - an operation is already in progress`,
      life: srToastStore.getLife()
    })
    return
  }
  if (stackStatusStore.isClusterUndestroyable(clusterName)) {
    toast.add({
      severity: 'warn',
      summary: 'Cannot Destroy Cluster',
      detail: `Cluster "${clusterName}" cannot be destroyed in its current state`,
      life: srToastStore.getLife()
    })
    return
  }
  if (
    sysConfigStore.currentSlideRuleCluster &&
    clusterName === sysConfigStore.currentSlideRuleCluster
  ) {
    toast.add({
      severity: 'warn',
      summary: 'Cannot Destroy Public Cluster',
      detail: `Cluster "${clusterName}" is the current public SlideRule cluster and cannot be destroyed`,
      life: srToastStore.getLife()
    })
    return
  }

  // Set pending operation (persists until status confirms)
  stackStatusStore.setPendingOperation(clusterName, 'destroy')
  destroying.value = true

  confirm.require({
    group: 'appbar',
    message: `Are you sure you want to destroy the cluster "${clusterName}"? This action cannot be undone.`,
    header: 'Destroy Cluster',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Destroy',
    rejectClass: 'p-button-secondary',
    acceptClass: 'p-button-danger',
    accept: () => {
      void executeDestroyCluster()
      // Navigate to server view deploy tab to show progress
      void router.push({ path: '/server', query: { tab: 'deployconfig' } })
    },
    reject: () => {
      destroying.value = false
      stackStatusStore.clearPendingOperation(clusterName)
    }
  })
}

const mobileMenu = ref<InstanceType<typeof Menu> | null>(null)

const mobileMenuItems = computed(() => {
  const items: MenuItem[] = [
    {
      label: 'Home',
      icon: 'pi pi-home',
      command: handleHomeButtonClick
    },
    {
      label: 'Request',
      icon: 'pi pi-sliders-h',
      command: handleRequestButtonClick
    },
    {
      label: 'RecordTree',
      icon: 'pi pi-list',
      command: handleRecTreeButtonClick
    },
    {
      label: 'Analysis',
      icon: 'pi pi-chart-line',
      command: handleAnalysisButtonClick
    },
    {
      label: 'Settings',
      icon: 'pi pi-cog',
      command: handleSettingsButtonClick
    },
    {
      label: 'Docs',
      icon: 'pi pi-info-circle',
      command: openDocs
    }
  ]

  // Add user menu when authenticated, or login option when not
  if (isGitHubAuthenticated.value) {
    items.push({
      label: githubUsername.value || 'Account',
      icon: 'pi pi-user',
      items: userMenuItems.value
    })
  } else {
    items.push({
      label: 'Login',
      icon: 'pi pi-github',
      command: handleGitHubLogin
    })
  }

  return items
})

const toggleMobileMenu = (event: Event) => {
  mobileMenu.value?.toggle(event)
}

function setDarkMode() {
  const element = document.querySelector('html')
  if (element) {
    element.classList.add('sr-app-dark')
  } else {
    logger.error('Could not find html element to set dark mode')
  }
}

function dumpRouteInfo() {
  logger.debug('Route name', { name: route.name })
  logger.debug('Route route', { fullPath: route.fullPath })
  logger.debug('Route path', { path: route.path })
  logger.debug('Route params', { params: route.params })
  logger.debug('Route query', { query: route.query })
}

onMounted(async () => {
  setDarkMode()
  await sysConfigStore.fetchServerVersionInfo()
  await sysConfigStore.fetchCurrentNodes()
  dumpRouteInfo()
})

const feedbackMenu = ref<InstanceType<typeof Menu> | null>(null)
const feedbackMenuItems = [
  {
    label: 'support@slideruleearth.io',
    icon: 'pi pi-envelope',
    command: () => {
      window.location.href = 'mailto:support@slideruleearth.io'
    }
  },
  {
    label: 'Open a GitHub Issue',
    icon: 'pi pi-github',
    command: () => {
      window.open('https://github.com/SlideRuleEarth/sliderule-web-client/issues/new', '_blank')
    }
  }
]
const toggleFeedbackMenu = (event: Event) => {
  feedbackMenu.value?.toggle(event)
}
const isHovering = ref(false)
let showTooltipTimeout: number | null = null

const showServerTooltip = (event: MouseEvent) => {
  isHovering.value = true

  if (!tooltipRef.value) return

  // Slight delay to avoid flicker if mouse quickly moves out
  if (showTooltipTimeout) clearTimeout(showTooltipTimeout)
  showTooltipTimeout = window.setTimeout(async () => {
    if (!isHovering.value) return

    try {
      const nodesStr = await sysConfigStore.fetchCurrentNodes()
      if (isHovering.value) {
        tooltipRef.value.showTooltip(
          event,
          `Server Version: ${sysConfigStore.version}<br>Nodes: ${nodesStr}<br>Click to see server details`
        )
      }
    } catch (error) {
      logger.error('Failed to fetch server status', {
        error: error instanceof Error ? error.message : String(error)
      })
      if (isHovering.value) {
        tooltipRef.value.showTooltip(
          event,
          `Server Version: ${sysConfigStore.version}<br>Nodes: unknown<br>Click to see server details`
        )
      }
    }
  }, 200) // Delay to avoid fast re-triggers
}

function hideTooltip() {
  isHovering.value = false
  if (showTooltipTimeout) {
    clearTimeout(showTooltipTimeout)
    showTooltipTimeout = null
  }
  tooltipRef.value?.hideTooltip()
}
</script>

<template>
  <ConfirmDialog group="appbar" />
  <div class="sr-nav-container" id="sr-nav-container">
    <div class="left-content">
      <Button
        icon="pi pi-bars"
        class="p-button-rounded p-button-text mobile-menu-button"
        id="sr-mobile-menu-button"
        @click="toggleMobileMenu"
      >
      </Button>
      <Menu :model="mobileMenuItems" popup ref="mobileMenu" />
      <img src="/IceSat-2_SlideRule_logo.png" alt="SlideRule logo" class="logo" />
      <span
        class="sr-title-wrapper"
        @mouseover="showServerTooltip($event)"
        @mouseleave="hideTooltip()"
      >
        <Button
          type="button"
          label="SlideRule"
          id="sr-sliderule-button"
          class="p-button-rounded p-button-text sr-title"
          :class="slideruleNodesClass"
          @click="handleSlideruleButtonClick"
        />
        <span v-if="testVersionWarning" class="sr-title-badge">{{ testVersionWarning }}</span>
      </span>
      <Button
        v-if="showSubDomainBadge"
        type="button"
        :label="subDomainBadgeLabel"
        :severity="subDomainBadgeSeverity"
        class="sr-org-menu-button"
        size="small"
        @click="toggleSubDomainMenu"
      />
      <Menu :model="subDomainMenuItems" popup ref="subDomainMenu" />
      <Button
        icon="pi pi-home"
        id="sr-home-button"
        label="Home"
        class="p-button-rounded p-button-text desktop-only"
        @click="handleHomeButtonClick"
      >
      </Button>
      <div
        class="sr-megaphone"
        @mouseover="
          tooltipRef.showTooltip(
            $event,
            'Got a question about SlideRule?<br>Something not working?<br>Want a new feature?<br>Click here to send us an email or open a GitHub issue.<br>We want to hear from you!<br><br>Remember: The squeaky wheel gets the oil!'
          )
        "
        @mouseleave="hideTooltip()"
      >
        <Button
          icon="pi pi-megaphone"
          label="Feedback"
          id="sr-feedback-button"
          class="p-button-rounded p-button-text desktop-only tablet-icon-only"
          @click="toggleFeedbackMenu"
        ></Button>
        <Menu :model="feedbackMenuItems" popup ref="feedbackMenu">
          <template #item="{ item, props: itemProps }">
            <a v-bind="itemProps.action">
              <span :class="item.icon"></span>
              <span class="p-menuitem-text">{{ item.label }}</span>
              <i
                class="pi pi-external-link"
                style="font-size: 0.65rem; opacity: 0.5; margin-left: 0.5rem"
              ></i>
            </a>
          </template>
        </Menu>
      </div>
      <Button
        icon="pi pi-question-circle"
        id="sr-help-button"
        label="Help"
        class="p-button-rounded p-button-text desktop-only"
        @click="toggleHelpMenu"
      >
      </Button>
      <Menu :model="helpMenuItems" popup ref="helpMenu" />
    </div>
    <div class="middle-content">
      <span v-if="showBanner" class="sr-banner-text" :style="bannerStyle">{{ bannerText }}</span>
      <div class="sr-tooltip-style" id="tooltip">
        <SrCustomTooltip ref="tooltipRef" id="appBarTooltip" />
      </div>
    </div>
    <div class="right-content" id="sr-appbar-right-content">
      <Button
        icon="pi pi-sliders-h"
        id="sr-request-button"
        label="Request"
        class="p-button-rounded p-button-text desktop-only"
        @click="handleRequestButtonClick"
      >
      </Button>
      <Button
        icon="pi pi-align-left"
        id="sr-records-button"
        label="Records"
        class="p-button-rounded p-button-text desktop-only"
        @click="handleRecTreeButtonClick"
      >
      </Button>
      <Button
        icon="pi pi-chart-line"
        id="sr-analysis-button"
        label="Analysis"
        class="p-button-rounded p-button-text desktop-only"
        @click="handleAnalysisButtonClick"
      >
      </Button>
      <Button
        icon="pi pi-cog"
        id="sr-settings-button"
        label="Settings"
        class="p-button-rounded p-button-text desktop-only"
        @click="handleSettingsButtonClick"
      >
      </Button>
      <Button
        icon="pi pi-info-circle"
        id="sr-about-button"
        label="Docs"
        class="p-button-rounded p-button-text desktop-only tablet-icon-only"
        @click="toggleDocsMenu"
      >
      </Button>
      <Menu :model="docsMenuItems" popup ref="docsMenu">
        <template #item="{ item, props: itemProps }">
          <a v-bind="itemProps.action">
            <span :class="item.icon"></span>
            <span class="p-menuitem-text">{{ item.label }}</span>
            <i
              class="pi pi-external-link"
              style="font-size: 0.65rem; opacity: 0.5; margin-left: 0.5rem"
            ></i>
          </a>
        </template>
      </Menu>
      <Button
        v-if="!isGitHubAuthenticated"
        icon="pi pi-github"
        id="sr-login-button"
        label="Login"
        title="Login with GitHub to access member features"
        class="p-button-rounded p-button-text desktop-only"
        :class="{ 'sr-login-pulse': !isGitHubAuthenticating }"
        :loading="isGitHubAuthenticating"
        :disabled="isGitHubAuthenticating"
        @click="handleGitHubLogin"
      >
      </Button>
      <Button
        v-if="isGitHubAuthenticated"
        id="sr-user-button"
        :label="githubUsername || 'Account'"
        class="p-button-rounded p-button-text desktop-only sr-user-button"
        @click="toggleUserMenu"
      >
        <template #icon>
          <i class="pi pi-user"></i>
          <span v-if="githubIsOwner" class="sr-role-badge sr-role-owner">Owner</span>
          <span v-else-if="githubIsMember" class="sr-role-badge sr-role-member">Member</span>
        </template>
      </Button>
      <Menu :model="userMenuItems" popup ref="userMenu" />
    </div>
  </div>

  <SrUserUtilsDialog v-model:visible="showUserUtilsDialog" />
  <SrTokenUtilsDialog v-model:visible="showTokenUtilsDialog" />
</template>

<style scoped>
/* Draws attention to Login until the user signs in */
.sr-login-pulse {
  animation: sr-login-pulse 2s ease-in-out infinite;
}

@keyframes sr-login-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
  50% {
    box-shadow: 0 0 0.6rem 0.2rem var(--p-primary-color);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sr-login-pulse {
    animation: none;
    box-shadow: 0 0 0.4rem 0.15rem var(--p-primary-color);
  }
}

.sr-org-menu-button {
  margin-left: 0.5rem;
  font-size: 0.75rem;
}

.sr-nav-container {
  height: 4rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem;
  padding-left: 1rem;
}

.center-content {
  display: flex;
  align-items: center;
}

.sr-title-wrapper {
  position: relative;
  display: inline-block;
}

:deep(.p-button.sr-title) {
  font-size: 1.5rem;
  font-weight: 600;
}

:deep(.p-button.sr-title.sr-nodes-low) {
  color: var(--p-yellow-400);
}

:deep(.p-button.sr-title.sr-nodes-none) {
  color: var(--p-red-400);
}

.sr-title-badge {
  position: absolute;
  top: -0.5rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.55rem;
  color: red;
  white-space: nowrap;
  font-weight: 500;
}

.sr-debug-width {
  position: absolute;
  bottom: -0.75rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.5rem;
  color: orange;
  white-space: nowrap;
  font-weight: 500;
  background: rgba(0, 0, 0, 0.5);
  padding: 0 0.25rem;
  border-radius: 2px;
}

.sr-org-badge {
  margin-left: 0.5rem;
  font-size: 0.75rem;
}

.ol-geocoder {
  display: flex;
  align-items: center;
  background-color: red;
}

.gcd-gl-sr-nav-container {
  width: 100%;
}

.right-content {
  display: flex;
  align-items: center;
}

.left-content {
  display: flex;
  align-items: center;
  gap: 0.5rem; /* Adds space between items */
  height: 100%;
}
.middle-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  flex-grow: 1; /* Allows this section to take up available space */
}

.logo {
  height: 2.75rem;
  /* Adjust as needed */
  object-fit: contain;
}

.responsive-input {
  width: 100%;
  /* Full width on smaller screens */
  min-width: 21rem;
}
.sr-banner-text {
  font-size: smaller;
  color: var(--p-button-text-primary-color);
  margin-left: 0.5rem;
  max-width: 20rem;
  word-wrap: break-word;
}
@media (min-width: 600px) {
  /* Adjust the breakpoint as needed */
  .responsive-input {
    width: 300px;
    /* Fixed width on larger screens */
  }
}

/* Tablet: show icon-only for certain buttons */
@media (min-width: 769px) and (max-width: 1200px) {
  .tablet-icon-only :deep(.p-button-label) {
    display: none;
  }
}

@media (max-width: 768px) {
  .sr-nav-container {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding-right: 1rem;
  }

  .right-content {
    display: none;
  }

  .mobile-menu-button {
    display: inline-flex !important;
    /* Force display on mobile */
    order: -1; /* Ensures it's the first item */
  }

  .logo {
    height: 2.5rem; /* Slightly reduce logo size on mobile if needed */
  }
}

@media (max-width: 480px) {
  .logo {
    height: 40px;
  }

  .right-content {
    flex-direction: column;
    align-items: flex-end;
  }
}

.mobile-menu-button {
  display: none;
  /* Hide by default for desktop */
}

:deep(.p-button-rounded:hover) {
  border-width: 1px;
  border-color: var(--primary-color);
  box-shadow:
    0 0 12px var(--p-button-primary-border-color),
    0 0 20px var(--p-button-primary-border-color);
  transition: box-shadow 0.3s ease;
}

:deep(.p-button-text:hover) {
  border-width: 1px;
  border-color: var(--primary-color);
  box-shadow:
    0 0 12px var(--p-button-primary-border-color),
    0 0 20px var(--p-button-primary-border-color);
  transition: box-shadow 0.3s ease;
}

/* User button with role badge */
.sr-user-button {
  position: relative;
}

.sr-role-badge {
  font-size: 0.55rem;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  margin-left: 0.25rem;
  font-weight: 600;
  vertical-align: middle;
}

.sr-role-owner {
  background-color: var(--p-green-500);
  color: white;
}

.sr-role-member {
  background-color: var(--p-green-500);
  color: white;
}
</style>
