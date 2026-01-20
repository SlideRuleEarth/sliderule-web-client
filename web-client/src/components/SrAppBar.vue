<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
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
import { useRoute, useRouter } from 'vue-router'
import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
import SrUserUtilsDialog from '@/components/SrUserUtilsDialog.vue'
import SrTokenUtilsDialog from '@/components/SrTokenUtilsDialog.vue'
import { createLogger } from '@/utils/logger'
import { destroyCluster } from '@/utils/fetchUtils'

const logger = createLogger('SrAppBar')

const build_env = import.meta.env.VITE_BUILD_ENV
const banner_text = import.meta.env.VITE_BANNER_TEXT
const sysConfigStore = useSysConfigStore()
const githubAuthStore = useGitHubAuthStore()
const stackStatusStore = useStackStatusStore()
const clusterSelectionStore = useClusterSelectionStore()
const deployConfigStore = useDeployConfigStore()
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
const _isGitHubAuthenticating = computed(() => githubAuthStore.authStatus === 'authenticating')
const githubUsername = computed(() => githubAuthStore.username)
const githubIsMember = computed(() => githubAuthStore.isMember)
const githubIsOwner = computed(() => githubAuthStore.isOwner)
// TODO: Re-enable when GitHub login button is restored
function _handleGitHubLogin() {
  githubAuthStore.initiateLogin()
}

const displayTour = computed(() => {
  return route.name === 'home' || route.name === 'request'
})

const tourMenu = ref<InstanceType<typeof Menu> | null>(null)

const tourMenuItems = [
  {
    label: 'Quick Tour',
    icon: 'pi pi-bolt',
    command: () => {
      emit('quick-tour-button-click')
    }
  },
  {
    label: 'Long Tour',
    icon: 'pi pi-compass',
    command: () => {
      emit('long-tour-button-click')
    }
  }
]

const toggleTourMenu = (event: Event) => {
  tourMenu.value?.toggle(event)
}

const aboutMenu = ref<InstanceType<typeof Menu> | null>(null)
const aboutMenuItems = [
  {
    label: 'About SlideRule Web Client',
    icon: 'pi pi-info-circle',
    command: () => {
      emit('client-version-button-click')
    }
  },
  {
    label: 'About SlideRule Server',
    icon: 'pi pi-info-circle',
    command: () => {
      emit('server-version-button-click')
    }
  },
  {
    label: 'About SlideRule',
    icon: 'pi pi-info-circle',
    command: () => {
      window.open('https://slideruleearth.io')
    }
  },
  {
    label: 'SlideRule Buzz',
    icon: 'pi pi-calculator',
    command: () => {
      emit('sliderule-buzz-button-click')
    }
  },
  {
    separator: true
  },
  {
    label: 'Documentation',
    icon: 'pi pi-book',
    items: [
      {
        label: 'SlideRule Python Client Documentation',
        icon: 'pi pi-book',
        command: () => {
          window.open('https://slideruleearth.io/web/rtd/')
        }
      },
      {
        label: 'ATLAS/ICESat-2 Photon Data User Guide',
        icon: 'pi pi-book',
        command: () => {
          window.open(
            'https://nsidc.org/sites/default/files/documents/user-guide/atl03-v006-userguide.pdf'
          )
        }
      },
      {
        label: 'Algorithm Theoretical Basis Document Atl03',
        icon: 'pi pi-book',
        command: () => {
          window.open(
            'https://nsidc.org/sites/default/files/documents/technical-reference/icesat2_atl03_atbd_v006.pdf'
          )
        }
      }
    ]
  },
  {
    separator: true
  },
  {
    label: 'Report an Issue',
    icon: 'pi pi-exclamation-circle',
    command: () => {
      window.open('https://github.com/SlideRuleEarth/sliderule-web-client/issues', '_blank')
    }
  },
  {
    label: 'Contact Support',
    icon: 'pi pi-envelope',
    command: () => {
      window.location.href = 'mailto:support@mail.slideruleearth.io'
    }
  }
]

const toggleAboutMenu = (event: Event) => {
  aboutMenu.value?.toggle(event)
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
  'server-version-button-click',
  'client-version-button-click',
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

const nodeBadgeSeverity = computed(() => {
  const canGetVersion = sysConfigStore.canConnectVersion
  const canGetNodes = sysConfigStore.canConnectNodes

  //console.log('nodeBadgeSeverity canGetNodes:', canGetNodes, 'canGetVersion:', canGetVersion, 'current_nodes:', sysConfigStore.current_nodes);
  if (sysConfigStore.current_nodes <= 0) return 'warning' // no nodes available
  if (canGetNodes !== 'yes' && canGetVersion !== 'yes') return 'danger' // both failed
  if (canGetNodes === 'no' || canGetVersion === 'no') return 'danger' // one failed
  if (canGetNodes === 'unknown' || canGetVersion === 'unknown') return 'warning' // one or both unknown
  return 'info' // both yes and >0
})

const badgeLabel = computed(() => {
  return sysConfigStore.current_nodes >= 0 ? `server ${sysConfigStore.current_nodes}` : 'server ?'
})

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
const handleServerVersionButtonClick = () => {
  emit('server-version-button-click')
}
const handleClientVersionButtonClick = () => {
  emit('client-version-button-click')
}

function getClientVersionString(input: string): string {
  // Find the index of the first "-"
  const dashIndex = input.indexOf('-')

  // If a dash is found, return the substring up to that point
  // If no dash is found, return the full input
  return dashIndex !== -1 ? input.substring(0, dashIndex) : input
}

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

const formattedClientVersion = computed(() => {
  logger.debug('build_env', { build_env })
  //console.log('typeof build_env:', (typeof build_env));
  if (typeof build_env === 'string') {
    const version = getClientVersionString(build_env)
    const formattedVersion = isThisClean(build_env) ? version : `${version}*`
    logger.debug('formattedVersion', { formattedVersion })
    return formattedVersion
  } else {
    return 'v?.?.?'
  }
})

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

const computedServerVersionLabel = computed(() => {
  return sysConfigStore.version || 'v?.?.?'
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
    if (result.success && result.data?.status) {
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
      const exception = result.data?.exception
      const errorMsg = exception ?? result.error ?? 'Destroy failed'
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
  const items = [
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
      label: 'About',
      icon: 'pi pi-info-circle',
      items: aboutMenuItems
    }
  ]

  // Add user menu when authenticated
  if (isGitHubAuthenticated.value) {
    items.push({
      label: githubUsername.value || 'Account',
      icon: 'pi pi-user',
      items: userMenuItems.value
    })
  }
  // ============================================================================
  // TEMPORARILY DISABLED: GitHub Login in mobile menu
  // The GitHub Login functionality has been temporarily hidden from the UI.
  // To re-enable, uncomment the else block below.
  // ============================================================================
  // else {
  //   items.push({
  //     label: 'Login',
  //     icon: 'pi pi-github',
  //     command: handleGitHubLogin
  //   })
  // }

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

const openMailClient = () => {
  window.location.href = 'mailto:support@mail.slideruleearth.io'
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
      <span class="sr-title-wrapper">
        <span class="sr-title">SlideRule</span>
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
      <div
        class="sr-show-server-version"
        @mouseover="showServerTooltip($event)"
        @mouseleave="hideTooltip()"
      >
        <Button
          type="button"
          :label="computedServerVersionLabel"
          :class="['p-button-text', 'desktop-only', 'sr-server-version', nodeBadgeSeverity]"
          id="sr-server-version-button"
          :badge="badgeLabel"
          @click="handleServerVersionButtonClick"
        >
        </Button>
      </div>
      <Button
        type="button"
        :label="formattedClientVersion"
        class="p-button-text desktop-only sr-client-version"
        id="sr-client-version-button"
        badge="web_client"
        @click="handleClientVersionButtonClick"
      >
      </Button>
    </div>
    <div class="middle-content">
      <Button
        icon="pi pi-map"
        id="sr-tour-button"
        v-if="displayTour"
        label="Tour"
        class="p-button-rounded p-button-text desktop-only"
        @click="toggleTourMenu"
      >
      </Button>
      <Menu :model="tourMenuItems" popup ref="tourMenu" />
      <div
        class="sr-megaphone"
        @mouseover="
          tooltipRef.showTooltip(
            $event,
            'Got a question about SlideRule?<br>Something not working?<br>Want a new feature?<br>Click here to send us an email.<br>We want to hear from you!<br><br>Remember: The squeaky wheel gets the oil!'
          )
        "
        @mouseleave="hideTooltip()"
      >
        <Button
          icon="pi pi-megaphone"
          label="Feedback"
          id="sr-feedback-button"
          class="p-button-rounded p-button-text desktop-only tablet-icon-only"
          @click="openMailClient"
        ></Button>
      </div>
      <span v-if="showBanner" class="sr-banner-text">{{ bannerText }}</span>
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
        label="About"
        class="p-button-rounded p-button-text desktop-only tablet-icon-only"
        @click="toggleAboutMenu"
      >
      </Button>
      <Menu :model="aboutMenuItems" popup ref="aboutMenu" />
      <!-- ====================================================================
           TEMPORARILY DISABLED: GitHub Login Button
           The GitHub Login functionality has been temporarily hidden from the UI.
           To re-enable, uncomment the Button below.
           ==================================================================== -->
      <!-- <Button
        v-if="!isGitHubAuthenticated"
        icon="pi pi-github"
        id="sr-login-button"
        label="Login"
        title="Login with GitHub to access member features"
        class="p-button-rounded p-button-text desktop-only"
        :loading="isGitHubAuthenticating"
        :disabled="isGitHubAuthenticating"
        @click="handleGitHubLogin"
      >
      </Button> -->
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
  margin-left: 0.5rem;
}

.sr-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--p-button-text-primary-color);
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
  align-items: right;
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
  color: red;
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

:deep(.p-button.sr-server-version) {
  position: relative;
  padding-top: 0.5rem;
  padding-bottom: 0.0625rem;
  padding-left: 0.25rem;
  padding-right: 0.5rem;
  font-size: 0.9rem;
  border-radius: 0;
}

:deep(.p-button.sr-client-version) {
  position: relative;
  padding-top: 0.5rem;
  padding-bottom: 0.0625rem;
  padding-left: 0.25rem;
  padding-right: 0.5rem;
  font-size: 0.9rem;
  border-radius: 0;
}

:deep(.p-button.sr-server-version .p-badge) {
  position: absolute;
  top: -0.2rem; /* Adjust vertical placement */
  left: 50%; /* Center horizontally */
  transform: translateX(-50%); /* Perfect centering */
  font-size: 0.6rem;
  padding: 0.25rem 0.4rem;
  color: var(--p-primary-300);
  background-color: transparent;
}

:deep(.p-button.sr-client-version .p-badge) {
  position: absolute;
  top: -0.2rem; /* Adjust vertical placement */
  left: 50%; /* Center horizontally */
  transform: translateX(-50%); /* Perfect centering */
  font-size: 0.6rem;
  padding: 0.25rem 0.4rem;
  color: var(--p-primary-300);
  background-color: transparent;
}
:deep(.p-button.sr-server-version.info .p-badge) {
  color: var(--p-primary-300);
  white-space: nowrap;
}
:deep(.p-button.sr-server-version.warning .p-badge) {
  color: var(--p-yellow-300);
  white-space: nowrap;
}
:deep(.p-button.sr-server-version.danger .p-badge) {
  white-space: nowrap;
  color: var(--p-red-300);
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
