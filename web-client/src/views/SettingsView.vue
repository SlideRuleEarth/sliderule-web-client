<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import SingleColumnLayout from '@/layouts/SingleColumnLayout.vue'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import SrClearCache from '@/components/SrClearCache.vue'
import SrLegacyProvSys from '@/components/SrLegacyProvSys.vue'
import SrStorageUsage from '@/components/SrStorageUsage.vue'
import SrAdvOptPanel from '@/components/SrAdvOptPanel.vue'
import SrDefaults from '@/components/SrDefaults.vue'
import SrGoogleApiKeyInput from '@/components/SrGoogleApiKeyInput.vue'
import SrGitHubOrgAuth from '@/components/SrGitHubOrgAuth.vue'
import SrTokenDetails from '@/components/SrTokenDetails.vue'
import SrSysConfig from '@/components/SrSysConfig.vue'
import SrDeployConfig from '@/components/SrDeployConfig.vue'
import Card from 'primevue/card'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { useJwtStore } from '@/stores/SrJWTStore'

const githubAuthStore = useGitHubAuthStore()
const sysConfigStore = useSysConfigStore()
const jwtStore = useJwtStore()

// Hide Legacy Provisioning when user has valid GitHub auth
const showLegacyProvisioning = computed(() => !githubAuthStore.canAccessMemberFeatures)

// Reset to public cluster when GitHub auth succeeds
async function resetToPublicCluster() {
  jwtStore.clearAllJwts()
  sysConfigStore.$reset()
  // Set defaults: slideruleearth.io and sliderule
  sysConfigStore.setDomain('slideruleearth.io')
  sysConfigStore.setOrganization('sliderule')
  await sysConfigStore.fetchServerVersionInfo()
  await sysConfigStore.fetchCurrentNodes()
}

// Controls which accordion panels are open (array because multiple="true")
const activeAccordionPanels = ref<string[]>([])

// Check on mount if user just authenticated
onMounted(async () => {
  if (githubAuthStore.justAuthenticated) {
    // Open the Login and Token Details panels
    activeAccordionPanels.value = ['0', '1']
    // Reset to public cluster on successful GitHub auth
    await resetToPublicCluster()
    // Clear the flag so it doesn't expand again on page refresh
    githubAuthStore.clearJustAuthenticated()
  }
})

// Also watch in case the flag changes after mount (edge case)
watch(
  () => githubAuthStore.justAuthenticated,
  async (justAuth) => {
    if (justAuth) {
      // Open the Login panel
      activeAccordionPanels.value = ['0']
      // Reset to public cluster on successful GitHub auth
      await resetToPublicCluster()
      githubAuthStore.clearJustAuthenticated()
    }
  }
)
</script>

<template>
  <SingleColumnLayout>
    <template v-slot:sr-single-col>
      <Card class="sr-settings-opt-card">
        <template #title>
          <div class="sr-settings-title">Settings</div>
        </template>
        <template #content>
          <div class="sr-settings-opt-wrapper">
            <Accordion
              v-model:value="activeAccordionPanels"
              class="sr-settings-accordion"
              :multiple="true"
              expandIcon="pi pi-plus"
              collapseIcon="pi pi-minus"
            >
              <AccordionPanel value="0">
                <AccordionHeader>Login</AccordionHeader>
                <AccordionContent>
                  <SrGitHubOrgAuth />
                  <SrSysConfig v-if="githubAuthStore.hasValidAuth" />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel v-if="githubAuthStore.hasValidAuth" value="1">
                <AccordionHeader>Token Details</AccordionHeader>
                <AccordionContent>
                  <SrTokenDetails />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel v-if="githubAuthStore.canAccessMemberFeatures" value="2">
                <AccordionHeader>Deployment</AccordionHeader>
                <AccordionContent>
                  <SrDeployConfig />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel value="3">
                <AccordionHeader>Map Provider API Keys</AccordionHeader>
                <AccordionContent>
                  <SrGoogleApiKeyInput />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel value="4">
                <AccordionHeader>Storage Usage</AccordionHeader>
                <AccordionContent>
                  <SrStorageUsage />
                  <SrClearCache />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel value="5">
                <AccordionHeader>Advanced</AccordionHeader>
                <AccordionContent>
                  <SrAdvOptPanel />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel value="6">
                <AccordionHeader>Defaults</AccordionHeader>
                <AccordionContent>
                  <SrDefaults />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel v-if="showLegacyProvisioning" value="7">
                <AccordionHeader>Legacy Provisioning</AccordionHeader>
                <AccordionContent>
                  <SrLegacyProvSys />
                </AccordionContent>
              </AccordionPanel>
            </Accordion>
          </div>
        </template>
      </Card>
    </template>
  </SingleColumnLayout>
</template>

<style scoped>
/* Ensure consistent width of settings panel */
.sr-settings-opt-card {
  display: block;
  justify-content: center;
  align-items: center;
  width: 40rem; /* Adjust as needed */
  margin: 0 auto;
  padding: 1rem;
  background: var(--surface-ground, black);
  border-radius: 10px;
  box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.08);
}
.sr-settings-title {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.5rem; /* Adjust as needed */
  font-weight: bold;
  text-align: center;
  width: 100%;
  margin-bottom: 1rem;
}

/* Ensure wrapper maintains width */
.sr-settings-opt-wrapper {
  width: 100%;
  max-width: 100%; /* Prevent expansion */
  margin: 1rem;
  padding: 1rem;
}

/* Accordion must keep a fixed width */
.sr-settings-accordion {
  width: 100%;
  max-width: 100%;
  width: 40rem;
}

/* Prevent content from making accordion wider */
:deep(.p-accordion-content) {
  overflow: hidden; /* Prevents expanding width */
  word-wrap: break-word; /* Ensures long words don’t break layout */
  width: 100%;
}

/* Ensure accordion panels do not change width when expanded */
:deep(.p-accordion-panel) {
  width: 100%;
  max-width: 100%;
}
</style>
