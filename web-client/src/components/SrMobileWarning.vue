<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import { useMobileWarningStore } from '@/stores/mobileWarningStore'

const mobileWarningStore = useMobileWarningStore()

const showWarning = computed(() => mobileWarningStore.shouldShowWarning)

function dismiss() {
  mobileWarningStore.dismiss()
}
</script>

<template>
  <Transition name="fade">
    <div v-if="showWarning" class="sr-mobile-warning-overlay">
      <div class="sr-mobile-warning-card">
        <div class="sr-mobile-warning-icon">
          <i class="pi pi-exclamation-triangle" />
        </div>
        <h2 class="sr-mobile-warning-title">Mobile Device Detected</h2>
        <p class="sr-mobile-warning-text">
          This app requires a large screen and is not optimized for mobile phones.
        </p>
        <Button label="Continue Anyway" class="sr-mobile-warning-btn" @click="dismiss" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sr-mobile-warning-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.sr-mobile-warning-card {
  background: var(--p-surface-800, #1e1e1e);
  border: 1px solid var(--p-surface-600, #3e3e3e);
  border-radius: 0.75rem;
  padding: 2rem;
  max-width: 320px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.sr-mobile-warning-icon {
  font-size: 3rem;
  color: var(--p-yellow-500, #eab308);
  margin-bottom: 1rem;
}

.sr-mobile-warning-title {
  margin: 0 0 0.75rem 0;
  color: var(--p-text-color, #e0e0e0);
  font-size: 1.25rem;
  font-weight: 600;
}

.sr-mobile-warning-text {
  margin: 0 0 1.5rem 0;
  color: var(--p-text-muted-color, #a0a0a0);
  font-size: 0.95rem;
  line-height: 1.5;
}

.sr-mobile-warning-btn {
  width: 100%;
  font-weight: 500;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
