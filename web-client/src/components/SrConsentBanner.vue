<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import { usePrivacyConsentStore } from '@/stores/privacyConsentStore'

const router = useRouter()
const privacyConsentStore = usePrivacyConsentStore()

const showBanner = computed(() => privacyConsentStore.shouldShowBanner)

function acknowledge() {
  privacyConsentStore.acknowledge()
}

function goToPrivacyPolicy() {
  void router.push('/privacy')
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="showBanner" class="sr-consent-banner">
      <div class="sr-consent-content">
        <div class="sr-consent-text">
          <p>
            We use browser storage to save your preferences and authenticate your session.
            <a href="#" class="sr-privacy-link" @click.prevent="goToPrivacyPolicy">Learn more</a>
          </p>
        </div>
        <div class="sr-consent-buttons">
          <Button label="I Understand" class="sr-consent-btn" @click="acknowledge" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sr-consent-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--p-surface-800, #1e1e1e);
  border-top: 1px solid var(--p-surface-600, #3e3e3e);
  padding: 1rem 1.5rem;
  z-index: 1001;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
}

.sr-consent-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.sr-consent-text {
  flex: 1;
  min-width: 200px;
}

.sr-consent-text p {
  margin: 0;
  color: var(--p-text-color, #e0e0e0);
  font-size: 0.9rem;
  line-height: 1.5;
}

.sr-gpc-notice {
  color: var(--p-primary-color, #60a5fa);
  font-weight: 500;
}

.sr-privacy-link {
  color: var(--p-primary-color, #60a5fa);
  text-decoration: underline;
  cursor: pointer;
}

.sr-privacy-link:hover {
  color: var(--p-primary-400, #93c5fd);
}

.sr-consent-buttons {
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
}

/* Ensure buttons have equal visual weight (GDPR compliance) */
.sr-consent-btn {
  min-width: 130px;
  font-weight: 500;
}

/* Slide-up transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* Responsive: stack on mobile */
@media (max-width: 600px) {
  .sr-consent-content {
    flex-direction: column;
    text-align: center;
  }

  .sr-consent-buttons {
    width: 100%;
    justify-content: center;
  }

  .sr-consent-btn {
    flex: 1;
    min-width: 0;
  }
}
</style>
