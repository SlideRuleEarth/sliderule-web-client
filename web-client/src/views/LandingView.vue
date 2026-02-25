<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
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

// --- News ---

const ARTICLES_INDEX_URL = 'https://docs.slideruleearth.io/developer_guide/articles/articles.html'
const ARTICLES_BASE_URL = 'https://docs.slideruleearth.io/developer_guide/articles/'

interface NewsArticle {
  title: string
  date: string
  url: string
}

const newsArticles = ref<NewsArticle[]>([])
const selectedArticle = ref<NewsArticle | null>(null)
const articleHtml = ref('')
const newsLoading = ref(false)
const newsError = ref('')

async function fetchNewsIndex() {
  newsLoading.value = true
  newsError.value = ''
  newsArticles.value = []
  try {
    const res = await fetch(ARTICLES_INDEX_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const articles: NewsArticle[] = []
    doc.querySelectorAll('[role="main"] a[href]').forEach((el) => {
      const href = el.getAttribute('href') ?? ''
      if (!href.endsWith('.html') || href.startsWith('http')) return
      const text = el.textContent?.trim() ?? ''
      // Expected format: "YYYY-MM-DD: Title"
      const match = text.match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)$/)
      if (match) {
        articles.push({ date: match[1], title: match[2], url: href })
      }
    })
    // Sort newest first
    articles.sort((a, b) => b.date.localeCompare(a.date))
    newsArticles.value = articles
  } catch {
    newsError.value = 'Failed to load articles. Please try again later.'
  } finally {
    newsLoading.value = false
  }
}

async function fetchArticle(article: NewsArticle) {
  selectedArticle.value = article
  articleHtml.value = ''
  newsLoading.value = true
  newsError.value = ''
  try {
    const res = await fetch(ARTICLES_BASE_URL + article.url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const main = doc.querySelector('[role="main"]')
    if (main) {
      // Remove prev/next navigation links common in Sphinx
      main.querySelectorAll('.rst-footer-buttons, .footer, nav').forEach((n) => n.remove())
      articleHtml.value = main.innerHTML
    } else {
      articleHtml.value = '<p>Could not extract article content.</p>'
    }
  } catch {
    newsError.value = 'Failed to load article. Please try again later.'
    selectedArticle.value = null
  } finally {
    newsLoading.value = false
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
  if (tab === 'News') {
    selectedArticle.value = null
    void fetchNewsIndex()
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
      <div v-if="selectedTab !== 'News'" ref="panelRef" class="sr-landing-panel">
        <div v-if="panelHtml" class="sr-landing-panel-content">
          <div v-html="panelHtml" />
        </div>
        <div v-else class="sr-landing-panel-content">
          <p>Coming soon.</p>
        </div>
      </div>

      <!-- News -->
      <div v-else class="sr-landing-panel">
        <div v-if="newsLoading" class="sr-news-status">Loading...</div>
        <div v-else-if="newsError" class="sr-news-status sr-news-error">{{ newsError }}</div>
        <div v-else-if="selectedArticle" class="sr-landing-panel-content">
          <button class="sr-news-back" @click="selectedArticle = null">← Back</button>
          <div v-html="articleHtml" />
        </div>
        <ul v-else class="sr-news-list">
          <li v-for="a in newsArticles" :key="a.url" @click="fetchArticle(a)">
            <span class="sr-news-date">{{ a.date }}</span>
            <span class="sr-news-title">{{ a.title }}</span>
          </li>
        </ul>
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
  margin: 0 0 2rem 0;
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

.sr-news-title {
  color: #e0e0e0;
  transition: color 0.2s ease;
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
