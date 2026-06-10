<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import SelectButton from 'primevue/selectbutton'
import wallpaperUrl from '@/assets/landing_wallpaper.jpg'
import aboutRaw from '@/assets/content/about.md?raw'
import contactRaw from '@/assets/content/contact.md?raw'
import { DOCS } from '@/utils/docLinks'

function stripFrontmatter(md: string): string {
  return md.replace(/^---[\s\S]*?---\n*/, '')
}

const aboutHtml = DOMPurify.sanitize(marked(stripFrontmatter(aboutRaw)) as string)
const contactHtml = DOMPurify.sanitize(marked(stripFrontmatter(contactRaw)) as string)

const tabOptions = ['About', 'Contact', 'Release Notes']
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

// --- Release Notes ---

const RELEASE_NOTES_INDEX_URL = DOCS.releaseNotes.index
const RELEASE_NOTES_BASE_URL = DOCS.releaseNotes.base

interface ReleaseNote {
  title: string
  date: string
  url: string // external link: docs page (remote) or GitHub release tag (local)
  snippet?: string
  html?: string // precomputed detail HTML (local notes only)
}

const releaseNotes = ref<ReleaseNote[]>([])
const selectedRelease = ref<ReleaseNote | null>(null)
const releaseHtml = ref('')
const releaseLoading = ref(false)
const releaseError = ref('')

const showReleaseNotes = computed(() => selectedTab.value === 'Release Notes')

// --- Local web-client release notes (bundled markdown) ---

const localNoteModules = import.meta.glob('@/assets/content/release-notes/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const localReleaseNotes = computed<ReleaseNote[]>(() => {
  const notes = Object.entries(localNoteModules).map(([path, raw]) => {
    const version = path.split('/').pop()?.replace(/\.md$/, '') ?? ''
    const body = stripFrontmatter(raw)
    // First heading line, e.g. "# v4.5.2 — 2026-06-09"
    const header = body.match(/^#\s+(\S+)\s+[—-]\s+(\d{4}-\d{2}-\d{2})/m)
    const title = header?.[1] ?? version
    const date = header?.[2] ?? ''
    // First bullet line used as a one-line snippet in the list view.
    const bullet = body.match(/^\s*[-*]\s+(.+)$/m)
    const snippet = bullet?.[1] ?? ''
    const html = DOMPurify.sanitize(marked(body) as string)
    return {
      title: 'Web Client - ' + title,
      date,
      url: DOCS.webClient.tags + version,
      snippet,
      html
    }
  })
  return notes.sort((a, b) => b.date.localeCompare(a.date))
})

const currentNotes = computed<ReleaseNote[]>(() => {
  if (!showReleaseNotes.value) return []
  const combined = [...releaseNotes.value, ...localReleaseNotes.value]
  return combined.sort((a, b) => b.date.localeCompare(a.date))
})

const externalLink = computed(() => {
  if (!selectedRelease.value) return ''
  return selectedRelease.value.html
    ? selectedRelease.value.url
    : RELEASE_NOTES_BASE_URL + selectedRelease.value.url
})

const externalLinkLabel = computed(() =>
  selectedRelease.value?.html ? 'View on GitHub ↗' : 'View on docs site ↗'
)

function openRelease(note: ReleaseNote) {
  if (note.html) {
    selectedRelease.value = note
    releaseHtml.value = note.html
  } else {
    void fetchRelease(note)
  }
}

async function fetchReleaseNotesIndex() {
  releaseLoading.value = true
  releaseError.value = ''
  releaseNotes.value = []
  try {
    const res = await fetch(RELEASE_NOTES_INDEX_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const notes: ReleaseNote[] = []
    doc.querySelectorAll('[role="main"] a[href]').forEach((el) => {
      const href = el.getAttribute('href') ?? ''
      if (!href.endsWith('.html') || href.startsWith('http')) return
      const text = el.textContent?.trim() ?? ''
      // Matches "Release v5.4.x", "Release v5.4.1", "Web Client Release v4.5.0", etc.
      const match = text.match(/^(?:Web Client )?Release v[\d.x]+$/)
      if (match) {
        notes.push({ date: '', title: 'Server - ' + text, url: href })
      }
    })
    releaseNotes.value = notes
    void fetchEntryDetails()
  } catch {
    releaseError.value = 'Failed to load release notes. Please try again later.'
  } finally {
    releaseLoading.value = false
  }
}

async function fetchEntryDetails() {
  const MAX_SNIPPET_LENGTH = 200
  const DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/
  await Promise.allSettled(
    releaseNotes.value.map(async (note, index) => {
      try {
        const res = await fetch(RELEASE_NOTES_BASE_URL + note.url)
        if (!res.ok) return
        const html = await res.text()
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const main = doc.querySelector('[role="main"]')
        if (!main) return
        let date = ''
        let snippet = ''
        const dateMatch = main.textContent?.match(DATE_RE)
        if (dateMatch) date = dateMatch[1]
        const paragraphs = Array.from(main.querySelectorAll('p'))
        for (const p of paragraphs) {
          const text = p.textContent?.trim()
          if (text && text.length > 10 && !DATE_RE.test(text)) {
            snippet =
              text.length > MAX_SNIPPET_LENGTH ? text.slice(0, MAX_SNIPPET_LENGTH) + '...' : text
            break
          }
        }
        releaseNotes.value[index] = { ...note, date, snippet }
      } catch {
        // Detail fetch failures are non-critical — leave date/snippet empty
      }
    })
  )
  // Re-sort newest first once dates are populated; entries without a date
  // sort to the end via empty-string compare.
  releaseNotes.value = [...releaseNotes.value].sort((a, b) => b.date.localeCompare(a.date))
}

async function fetchRelease(note: ReleaseNote) {
  selectedRelease.value = note
  releaseHtml.value = ''
  releaseLoading.value = true
  releaseError.value = ''
  try {
    const res = await fetch(RELEASE_NOTES_BASE_URL + note.url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const main = doc.querySelector('[role="main"]')
    if (main) {
      // Remove prev/next navigation links common in Sphinx
      main.querySelectorAll('.rst-footer-buttons, .footer, nav').forEach((n) => n.remove())
      main.querySelectorAll('a.headerlink').forEach((n) => n.remove())
      releaseHtml.value = DOMPurify.sanitize(main.innerHTML)
    } else {
      releaseHtml.value = '<p>Could not extract release notes content.</p>'
    }
  } catch {
    releaseError.value = 'Failed to load release notes. Please try again later.'
    selectedRelease.value = null
  } finally {
    releaseLoading.value = false
  }
}

const panelRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (panelRef.value) {
    const scrollContainer = panelRef.value.closest('.sliderule-content')
    if (scrollContainer) {
      const panelTop = panelRef.value.offsetTop
      scrollContainer.scrollTo({
        top: panelTop - scrollContainer.clientHeight * 0.65,
        behavior: 'instant' as ScrollBehavior
      })
    }
  }
})

watch(selectedTab, (tab) => {
  selectedRelease.value = null
  releaseHtml.value = ''
  releaseError.value = ''
  if (tab === 'Release Notes') {
    void fetchReleaseNotesIndex()
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
      <!-- About / Contact -->
      <div v-if="!showReleaseNotes" ref="panelRef" class="sr-landing-panel">
        <div v-if="panelHtml" class="sr-landing-panel-content">
          <div v-html="panelHtml" />
        </div>
        <div v-else class="sr-landing-panel-content">
          <p>Coming soon.</p>
        </div>
      </div>

      <!-- Release Notes (combined: server + web client) -->
      <div v-else class="sr-landing-panel">
        <div v-if="releaseLoading" class="sr-news-status">Loading...</div>
        <div v-else-if="releaseError" class="sr-news-status sr-news-error">{{ releaseError }}</div>
        <div v-else-if="selectedRelease" class="sr-landing-panel-content">
          <button class="sr-news-back" @click="selectedRelease = null">← Back</button>
          <div v-html="releaseHtml" />
          <a
            class="sr-news-original-link"
            :href="externalLink"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ externalLinkLabel }}
          </a>
        </div>
        <ul v-else-if="currentNotes.length" class="sr-news-list">
          <li v-for="r in currentNotes" :key="r.url" @click="openRelease(r)">
            <span class="sr-news-date">{{ r.date }}</span>
            <div class="sr-news-body">
              <span class="sr-news-title">{{ r.title }}</span>
              <span v-if="r.snippet" class="sr-news-snippet">{{ r.snippet }}</span>
            </div>
          </li>
        </ul>
        <div v-else class="sr-news-status">No release notes available.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sr-landing {
  width: 100%;
  min-height: calc(100vh - 4rem);
  background-size: cover;
  background-position: center 70%;
  background-repeat: no-repeat;
  background-attachment: fixed;
}

.sr-landing-overlay {
  width: 100%;
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
  min-height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-start;
  text-align: left;
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
  margin: 0 0 8rem 0;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.sr-landing-tabs {
  display: flex;
  justify-content: center;
  align-self: center;
  width: 100%;
  margin-bottom: 1.5rem;
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
  background: rgba(0, 0, 0, 0.75);
  padding: 1.5rem 4rem;
  color: #e0e0e0;
  font-size: 0.95rem;
  line-height: 1.6;
}

.sr-landing-panel-content {
  max-width: 60rem;
  margin: 0 auto;
}

.sr-landing-panel-content :deep(a) {
  color: var(--p-primary-color, #60a5fa);
  text-decoration: underline;
}

.sr-system-overview {
  margin-top: 2rem;
  text-align: center;
}

.sr-system-overview h2 {
  margin-bottom: 1rem;
}

.sr-system-overview-img {
  max-width: 100%;
  border-radius: 4px;
}

.sr-news-list {
  list-style: none;
  padding: 0;
  margin: 0 auto;
  max-width: 60rem;
}

.sr-news-list li {
  display: flex;
  gap: 1.5rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: color 0.2s ease;
}

.sr-news-list li:hover .sr-news-title {
  color: #ffffff;
}

.sr-news-date {
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  font-size: 0.85rem;
  padding-top: 0.1rem;
}

.sr-news-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sr-news-title {
  color: #e0e0e0;
  transition: color 0.2s ease;
}

.sr-news-snippet {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.85rem;
  line-height: 1.4;
  margin-top: 0.2rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sr-news-back {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  padding: 0 0 1rem 0;
  font-size: 0.9rem;
  transition: color 0.2s ease;
}

.sr-news-back:hover {
  color: #ffffff;
}

.sr-news-original-link {
  display: inline-block;
  margin-top: 1.5rem;
  color: var(--p-primary-color, #60a5fa);
  font-size: 0.9rem;
  text-decoration: none;
  transition: color 0.2s ease;
}

.sr-news-original-link:hover {
  color: #ffffff;
  text-decoration: underline;
}

.sr-news-status {
  max-width: 60rem;
  margin: 0 auto;
  padding: 1rem 0;
  color: rgba(255, 255, 255, 0.5);
}

.sr-news-error {
  color: #f87171;
}

/* iOS/tablet: background-attachment:fixed is broken, disable parallax */
@media (hover: none) and (pointer: coarse) {
  .sr-landing {
    background-attachment: scroll;
    background-size: auto 140%;
    background-position: center 90%;
  }
}

@media (max-width: 768px) {
  .sr-landing-hero {
    padding: 1.5rem 1.5rem;
    align-items: flex-start;
    text-align: left;
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
