<script setup lang="ts">
import { ref, computed } from 'vue'
import { marked } from 'marked'
import SelectButton from 'primevue/selectbutton'
import wallpaperUrl from '@/assets/landing_wallpaper.jpg'
import aboutRaw from '@/assets/content/about.md?raw'
import contactRaw from '@/assets/content/contact.md?raw'

function stripFrontmatter(md: string): string {
  return md.replace(/^---[\s\S]*?---\n*/, '')
}

const aboutHtml = marked(stripFrontmatter(aboutRaw)) as string
const contactHtml = marked(stripFrontmatter(contactRaw)) as string

const tabOptions = ['About', 'Contact', 'News']
const selectedTab = ref('About')

const panelHtml = computed(() => {
  switch (selectedTab.value) {
    case 'About':
      return aboutHtml
    case 'Contact':
      return contactHtml
    default:
      return ''
  }
})
</script>

<template>
  <div class="sr-landing" :style="{ backgroundImage: `url(${wallpaperUrl})` }">
    <div class="sr-landing-overlay">
      <div class="sr-landing-hero">
        <h1 class="sr-landing-title">SlideRule Earth</h1>
        <p class="sr-landing-subtitle">
          Process Earth science datasets in the cloud through API calls to SlideRule web services.
        </p>
        <div class="sr-landing-tabs">
          <SelectButton v-model="selectedTab" :options="tabOptions" :allowEmpty="false" />
        </div>
      </div>
      <div class="sr-landing-panel">
        <div v-if="panelHtml" class="sr-landing-panel-content" v-html="panelHtml" />
        <div v-else class="sr-landing-panel-content">
          <p>Coming soon.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sr-landing {
  width: 100%;
  height: calc(100vh - 4rem);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.sr-landing-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.3) 0%,
    rgba(0, 0, 0, 0.4) 60%,
    rgba(0, 0, 0, 0.85) 100%
  );
}

.sr-landing-hero {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem 4rem;
}

.sr-landing-title {
  font-size: 3rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 1rem 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.sr-landing-subtitle {
  font-size: 1.4rem;
  color: #e0e0e0;
  max-width: 42rem;
  line-height: 1.5;
  margin: 0 0 2rem 0;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.sr-landing-tabs {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-bottom: 0.5rem;
}

.sr-landing-tabs :deep(.p-selectbutton) {
  border-radius: 2rem;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.sr-landing-tabs :deep(.p-selectbutton .p-togglebutton) {
  padding: 0.5rem 2rem;
  font-size: 1rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  border: none;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s ease;
}

.sr-landing-tabs :deep(.p-selectbutton .p-togglebutton:last-child) {
  border-right: none;
}

.sr-landing-tabs :deep(.p-selectbutton .p-togglebutton.p-togglebutton-checked) {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.08) 100%);
  color: #ffffff;
  font-weight: 600;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.sr-landing-tabs :deep(.p-selectbutton .p-togglebutton:hover) {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
}

.sr-landing-panel {
  flex: 0 0 40%;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.75);
  padding: 1.5rem 4rem;
  color: #e0e0e0;
  font-size: 0.95rem;
  line-height: 1.6;
}

.sr-landing-panel-content {
  max-width: 60rem;
}

.sr-landing-panel-content :deep(a) {
  color: var(--p-primary-color, #60a5fa);
  text-decoration: underline;
}

@media (max-width: 768px) {
  .sr-landing-hero {
    padding: 1.5rem 1.5rem;
    align-items: center;
    text-align: center;
  }

  .sr-landing-title {
    font-size: 2rem;
  }

  .sr-landing-subtitle {
    font-size: 1.1rem;
  }

  .sr-landing-panel {
    padding: 1rem 1.5rem;
  }

  .sr-landing-tabs :deep(.p-selectbutton .p-togglebutton) {
    padding: 0.4rem 1.2rem;
    font-size: 0.9rem;
  }
}
</style>
