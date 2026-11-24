<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'
import javascript from 'highlight.js/lib/languages/javascript'
import bash from 'highlight.js/lib/languages/bash'
import 'highlight.js/styles/atom-one-dark.css'
import DOMPurify from 'dompurify'
import { DOCS } from '@/utils/docLinks'

hljs.registerLanguage('python', python)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('bash', bash)

interface ClientOption {
  id: string
  label: string
  icon: string
  tagline: string
  title: string
  description: string
  install?: string
  code?: string
  language?: string
  links: { label: string; href: string }[]
}

const CLIENTS: ClientOption[] = [
  {
    id: 'web',
    label: 'Web',
    icon: 'pi pi-globe',
    tagline: 'No install, right in your browser',
    title: 'Use the web client',
    description:
      'The easiest way to get started. Draw a region on the map, run SlideRule, and explore the results as elevation profiles and 3D views. The Quick Tour in the Help menu walks you through it.',
    links: []
  },
  {
    id: 'python',
    label: 'Python',
    icon: 'pi pi-code',
    tagline: 'Results as GeoDataFrames',
    title: 'Python client',
    description:
      'The sliderule package on PyPI and conda-forge returns results as GeoPandas GeoDataFrames, ready for analysis in a notebook or script.',
    install: 'pip install sliderule',
    language: 'python',
    code: `from sliderule import sliderule, icesat2

sliderule.init(verbose=False)

region = [ {"lon":-105.82971551223244, "lat": 39.81983728534918},
           {"lon":-105.30742121965137, "lat": 39.81983728534918},
           {"lon":-105.30742121965137, "lat": 40.164048017973755},
           {"lon":-105.82971551223244, "lat": 40.164048017973755},
           {"lon":-105.82971551223244, "lat": 39.81983728534918} ]

parms = {
    "poly": region,
    "srt": icesat2.SRT_LAND,
    "cnf": icesat2.CNF_SURFACE_HIGH,
    "len": 40.0,
    "res": 20.0,
    "fit": {}
}

gdf = sliderule.run("atl03x", parms)`,
    links: [
      { label: 'Read the docs', href: DOCS.base },
      { label: 'PyPI', href: 'https://pypi.org/project/sliderule/' }
    ]
  },
  {
    id: 'nodejs',
    label: 'Node.js',
    icon: 'pi pi-server',
    tagline: 'For JavaScript applications',
    title: 'Node.js client',
    description:
      'The @sliderule/sliderule package on npm calls the same services from JavaScript and streams results back to your application.',
    install: 'npm install @sliderule/sliderule',
    language: 'javascript',
    code: `const sliderule = require('@sliderule/sliderule')

sliderule.core.get_version().then((result) => {
  console.log(result.server.version)
})`,
    links: [{ label: 'npm', href: 'https://www.npmjs.com/package/@sliderule/sliderule' }]
  },
  {
    id: 'curl',
    label: 'curl',
    icon: 'pi pi-desktop',
    tagline: 'Plain HTTP, any language',
    title: 'Call the API directly',
    description:
      'Every SlideRule service is a public HTTP endpoint. GET requests return JSON; POST a request body to run a processing job and receive the result as a file.',
    language: 'bash',
    code: `# check the server version
curl https://sliderule.slideruleearth.io/source/version

# subset ATL03 photons in a polygon and save them as Parquet
curl -X POST -d @atl03x.json -o atl03x.parquet \\
     https://sliderule.slideruleearth.io/source/atl03x.arrow`,
    links: [
      {
        label: 'Example atl03x.json',
        href: 'https://github.com/SlideRuleEarth/sliderule/blob/main/clients/curl/examples/atl03x.json'
      }
    ]
  }
]

const selectedId = ref(CLIENTS[0].id)
const selected = computed(() => CLIENTS.find((c) => c.id === selectedId.value) ?? CLIENTS[0])

const highlightedCode = computed(() => {
  const { code, language } = selected.value
  if (!code || !language) return ''
  return DOMPurify.sanitize(hljs.highlight(code, { language }).value)
})

const copied = ref('')
async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = key
    setTimeout(() => {
      if (copied.value === key) copied.value = ''
    }, 1500)
  } catch {
    copied.value = ''
  }
}

const QUICK_STEPS = [
  'Zoom in to your area of interest',
  'Select your desired data product',
  'Draw a region',
  'Click Run SlideRule'
]

const MOTIVATIONS = [
  {
    icon: 'pi pi-sliders-h',
    title: 'Broader science applications',
    text: 'By exposing processing parameters and pipeline configurations directly to users, SlideRule supports unforeseen science applications at no additional cost, using the same infrastructure that serves the mission’s primary science objectives.'
  },
  {
    icon: 'pi pi-share-alt',
    title: 'Integrated systems',
    text: 'Service-based architectures integrate with other data systems, combining the strengths of multiple organizations to deliver products that exceed what any one system can provide on its own.'
  },
  {
    icon: 'pi pi-bolt',
    title: 'Immediate updates',
    text: 'Algorithm improvements, bug fixes, and new capabilities are available immediately. Historical data need not be reprocessed or redownloaded, and multiple algorithm versions can coexist.'
  },
  {
    icon: 'pi pi-globe',
    title: 'Broader access',
    text: 'The volume of data from modern Earth-observing satellites, and the compute needed to process it, puts global-scale analysis out of reach for most users. SlideRule removes that barrier.'
  }
]
</script>

<template>
  <div class="sr-about">
    <!-- Intro: alternating heading / card rows -->
    <section class="sr-about-row">
      <h2 class="sr-about-row-heading">What is SlideRule</h2>
      <div class="sr-about-card">
        SlideRule is a <span class="sr-accent">public web service</span> that provides
        <span class="sr-accent">just-in-time</span> cloud-based processing of Earth science data. It
        is accessible through <span class="sr-accent">REST-like APIs</span> that return results
        directly to users. The goal of SlideRule is to provide researchers and downstream data
        systems with <span class="sr-accent">low-latency</span> access to derived data products
        using processing parameters supplied at the time of the request.
      </div>
    </section>

    <section class="sr-about-row sr-about-row-reverse">
      <h2 class="sr-about-row-heading">Who develops and maintains SlideRule</h2>
      <div class="sr-about-card">
        SlideRule is a collaboration between the
        <span class="sr-accent">University of Washington</span> and
        <span class="sr-accent">NASA</span> Goddard Space Flight Center with initial funding from
        the <span class="sr-accent">ICESat-2</span> program. SlideRule runs in AWS us-west-2 and has
        access to a growing list of Earth science datasets, including but not limited to the
        ICESat-2, GEDI, and HLS Earthdata Cloud archives. SlideRule is open-source under the BSD-3
        Clause License, and is openly developed at
        <a
          href="https://github.com/SlideRuleEarth/sliderule"
          target="_blank"
          rel="noopener noreferrer"
          >github.com/SlideRuleEarth/sliderule</a
        >.
      </div>
    </section>

    <!-- Getting started: tool selector -->
    <section class="sr-about-section">
      <h2 class="sr-about-section-heading">How can I start using SlideRule</h2>
      <p class="sr-about-section-lead">
        Use the web client on this site, or call the same services from your own code.
      </p>

      <div class="sr-start">
        <div class="sr-start-tabs" role="tablist" aria-label="Ways to use SlideRule">
          <button
            v-for="c in CLIENTS"
            :key="c.id"
            type="button"
            role="tab"
            :id="`sr-start-tab-${c.id}`"
            :aria-selected="c.id === selectedId"
            aria-controls="sr-start-panel"
            :class="['sr-start-tab', { 'sr-start-tab-active': c.id === selectedId }]"
            @click="selectedId = c.id"
          >
            <i :class="c.icon" aria-hidden="true"></i>
            <span class="sr-start-tab-text">
              <span class="sr-start-tab-label">{{ c.label }}</span>
              <span class="sr-start-tab-tagline">{{ c.tagline }}</span>
            </span>
          </button>
        </div>

        <div
          id="sr-start-panel"
          class="sr-start-panel"
          role="tabpanel"
          :aria-labelledby="`sr-start-tab-${selected.id}`"
        >
          <h3 class="sr-start-title">{{ selected.title }}</h3>
          <p class="sr-start-desc">{{ selected.description }}</p>

          <template v-if="selected.id === 'web'">
            <ol class="sr-start-steps">
              <li v-for="step in QUICK_STEPS" :key="step">{{ step }}</li>
            </ol>
            <RouterLink :to="{ name: 'request' }" class="sr-start-cta">
              Open the Request page <i class="pi pi-arrow-right" aria-hidden="true"></i>
            </RouterLink>
          </template>

          <template v-else>
            <div v-if="selected.install" class="sr-code sr-code-install">
              <code>$ {{ selected.install }}</code>
              <button
                type="button"
                class="sr-code-copy"
                aria-label="Copy install command"
                @click="copy(selected.install, 'install')"
              >
                <i :class="copied === 'install' ? 'pi pi-check' : 'pi pi-copy'"></i>
              </button>
            </div>
            <div class="sr-code">
              <pre><code v-html="highlightedCode"></code></pre>
              <button
                type="button"
                class="sr-code-copy"
                aria-label="Copy example"
                @click="copy(selected.code ?? '', 'code')"
              >
                <i :class="copied === 'code' ? 'pi pi-check' : 'pi pi-copy'"></i>
              </button>
            </div>
            <div class="sr-start-links">
              <a
                v-for="link in selected.links"
                :key="link.href"
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="sr-start-cta"
              >
                {{ link.label }} <i class="pi pi-external-link" aria-hidden="true"></i>
              </a>
            </div>
          </template>
        </div>
      </div>
    </section>

    <!-- Motivation: feature grid -->
    <section class="sr-about-section">
      <h2 class="sr-about-section-heading">What was the motivation for creating SlideRule</h2>
      <p class="sr-about-section-lead">
        SlideRule lowers the barrier to accessing and analyzing Earth science data by delivering
        customizable, on-demand data products and data-fusion services.
      </p>
      <div class="sr-feature-grid">
        <div v-for="m in MOTIVATIONS" :key="m.title" class="sr-feature">
          <i :class="['sr-feature-icon', m.icon]" aria-hidden="true"></i>
          <h3 class="sr-feature-title">{{ m.title }}</h3>
          <p class="sr-feature-text">{{ m.text }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sr-about {
  --sr-accent: var(--p-orange-400);
  --sr-card-bg: rgba(255, 255, 255, 0.08);
  --sr-card-border: rgba(255, 255, 255, 0.14);
  max-width: 72rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 5rem;
  padding: 2rem 0 3rem;
}

.sr-accent {
  color: var(--sr-accent);
}

.sr-about a {
  color: var(--p-primary-color);
}

/* Alternating heading / card rows */
.sr-about-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 4rem;
}

.sr-about-row-reverse .sr-about-row-heading {
  order: 2;
}

.sr-about-row-heading {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  color: #ffffff;
  text-align: center;
}

.sr-about-card {
  background: var(--sr-card-bg);
  border: 1px solid var(--sr-card-border);
  border-radius: 1rem;
  padding: 1.5rem 1.75rem;
  font-size: 1rem;
  line-height: 1.6;
}

/* Section headings */
.sr-about-section-heading {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
  font-weight: 600;
  color: #ffffff;
  text-align: center;
}

.sr-about-section-lead {
  max-width: 46rem;
  margin: 0 auto 2rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.65);
}

/* Getting-started selector */
.sr-start {
  display: grid;
  grid-template-columns: 16rem 1fr;
  gap: 1.5rem;
  align-items: start;
}

.sr-start-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sr-start-tab {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: transparent;
  border: 1px solid transparent;
  border-left: 3px solid transparent;
  border-radius: 0.5rem;
  color: rgba(255, 255, 255, 0.7);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.sr-start-tab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

.sr-start-tab:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

.sr-start-tab-active {
  background: var(--sr-card-bg);
  border-color: var(--sr-card-border);
  border-left-color: var(--sr-accent);
  color: #ffffff;
}

.sr-start-tab .pi {
  font-size: 1.1rem;
  width: 1.25rem;
  text-align: center;
}

.sr-start-tab-active .pi {
  color: var(--sr-accent);
}

.sr-start-tab-text {
  display: flex;
  flex-direction: column;
}

.sr-start-tab-label {
  font-weight: 600;
}

.sr-start-tab-tagline {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

.sr-start-panel {
  background: var(--sr-card-bg);
  border: 1px solid var(--sr-card-border);
  border-radius: 1rem;
  padding: 1.5rem 1.75rem;
  min-width: 0;
}

.sr-start-title {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  color: #ffffff;
}

.sr-start-desc {
  margin: 0 0 1.25rem;
}

.sr-start-steps {
  margin: 0 0 1.5rem;
  padding-left: 1.25rem;
}

.sr-start-steps li {
  padding: 0.15rem 0;
}

.sr-start-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-top: 1.25rem;
}

.sr-start-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--p-primary-color);
  font-weight: 600;
  text-decoration: none;
}

.sr-start-cta:hover {
  text-decoration: underline;
}

.sr-start-cta .pi {
  font-size: 0.75rem;
}

/* Code blocks */
.sr-code {
  position: relative;
  background: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.5rem;
}

.sr-code + .sr-code {
  margin-top: 0.75rem;
}

.sr-code pre {
  margin: 0;
  padding: 1rem 3rem 1rem 1rem;
  overflow-x: auto;
  font-size: 0.85rem;
  line-height: 1.5;
}

.sr-code-install {
  padding: 0.6rem 3rem 0.6rem 1rem;
  font-size: 0.9rem;
}

.sr-code-install code {
  color: #e0e0e0;
}

.sr-code-copy {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  padding: 0.35rem 0.45rem;
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
}

.sr-code-copy:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

/* Motivation grid */
.sr-feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.sr-feature {
  background: var(--sr-card-bg);
  border: 1px solid var(--sr-card-border);
  border-radius: 1rem;
  padding: 1.5rem;
}

.sr-feature-icon {
  font-size: 1.4rem;
  color: var(--sr-accent);
}

.sr-feature-title {
  margin: 0.75rem 0 0.5rem;
  font-size: 1.1rem;
  color: #ffffff;
}

.sr-feature-text {
  margin: 0;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.95rem;
}

@media (max-width: 900px) {
  .sr-about {
    gap: 3rem;
  }

  .sr-about-row {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .sr-about-row-reverse .sr-about-row-heading {
    order: 0;
  }

  .sr-about-row-heading {
    text-align: left;
  }

  .sr-start {
    grid-template-columns: 1fr;
  }

  .sr-start-tabs {
    flex-direction: row;
    overflow-x: auto;
  }

  .sr-start-tab {
    width: auto;
    flex-shrink: 0;
    border-left-width: 1px;
  }

  .sr-start-tab-active {
    border-left-color: var(--sr-card-border);
    border-bottom: 3px solid var(--sr-accent);
  }

  .sr-start-tab-tagline {
    display: none;
  }

  .sr-feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>
