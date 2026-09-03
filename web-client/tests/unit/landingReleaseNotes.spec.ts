// tests/unit/landingReleaseNotes.spec.ts
//
// The docs site moved from Sphinx to MyST (issue #1100): release notes now live
// at extensionless routes under /developer-guide/release-notes, and the page
// body is rendered into <article class="... article content">. These tests pin
// the parsing of that structure and the failure behaviour of the panel.
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import indexHtml from '../data/release-notes/index.html?raw'
import detailHtml from '../data/release-notes/detail.html?raw'

// PrimeVue's SelectButton is the only way to switch tabs; swap in a plain set
// of buttons so a test can click straight to "Release Notes".
vi.mock('primevue/selectbutton', () => ({
  default: defineComponent({
    props: {
      modelValue: { type: String, default: '' },
      options: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h(
          'div',
          (props.options as string[]).map((o) =>
            h('button', { 'data-tab': o, onClick: () => emit('update:modelValue', o) }, o)
          )
        )
    }
  })
}))

import LandingView from '@/views/LandingView.vue'
import { DOCS } from '@/utils/docLinks'

const DOCS_ORIGIN = 'https://docs.slideruleearth.io'

const htmlResponse = (body: string) =>
  new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } })

let fetchMock: ReturnType<typeof vi.fn>

/** Mount the landing view and switch to the Release Notes tab. */
async function openReleaseNotes() {
  const wrapper = mount(LandingView)
  await wrapper.find('[data-tab="Release Notes"]').trigger('click')
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof openReleaseNotes>>

const rows = (wrapper: Wrapper) => wrapper.findAll('.sr-news-list li').map((li) => li.text())

/**
 * The list interleaves server and bundled web-client notes by date, so a test
 * that wants a server note has to pick it out by title rather than by index.
 */
async function openServerNote(wrapper: Wrapper, title: string) {
  const row = wrapper.findAll('.sr-news-list li').find((li) => li.text().includes(title))
  expect(row, `no row for ${title}`).toBeTruthy()
  await row!.trigger('click')
  await flushPromises()
}

/** "Web Client - v4.7.1" / "Server - Release v5.4.x" -> a comparable number. */
function versionOf(title: string): number {
  const [major = 0, minor = 0, patch = 0] = (title.match(/v([\d.x]+)/)?.[1] ?? '')
    .split('.')
    .map((p) => (p === 'x' ? 0 : Number(p)))
  return major * 1e6 + minor * 1e3 + patch
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('release-notes index parsing', () => {
  it('requests the extensionless MyST index route', async () => {
    fetchMock.mockResolvedValue(htmlResponse(indexHtml))
    await openReleaseNotes()

    expect(DOCS.releaseNotes.index).toBe(`${DOCS_ORIGIN}/developer-guide/release-notes`)
    expect(fetchMock).toHaveBeenCalledWith(DOCS.releaseNotes.index)
  })

  it('lists each extensionless release route once, newest first', async () => {
    fetchMock.mockResolvedValue(htmlResponse(indexHtml))
    const wrapper = await openReleaseNotes()

    const server = rows(wrapper).filter((t) => t.includes('Server - '))
    expect(server).toHaveLength(5)
    expect(server[0]).toContain('Server - Release v5.4.x')
    expect(server[1]).toContain('Server - Release v5.3.x')
    expect(server[2]).toContain('Server - Release v5.2.x')
    expect(server[3]).toContain('Server - Release v5.0.x')
    expect(server[4]).toContain('Server - Release v4.20.x')
  })

  it('ignores the duplicate sidebar links and the prefixed footer nav link', async () => {
    fetchMock.mockResolvedValue(htmlResponse(indexHtml))
    const wrapper = await openReleaseNotes()

    // The fixture repeats all five releases in the sidebar and repeats v5.4.x
    // again in the footer nav, so a naive parse would report eleven entries.
    const v54 = rows(wrapper).filter((t) => t.includes('Release v5.4.x'))
    expect(v54).toHaveLength(1)
  })

  it('ignores non-release links inside the article', async () => {
    fetchMock.mockResolvedValue(htmlResponse(indexHtml))
    const wrapper = await openReleaseNotes()

    expect(rows(wrapper).some((t) => t.includes('Release and Deploy'))).toBe(false)
  })

  it('derives the release date from the slug without fetching detail pages', async () => {
    fetchMock.mockResolvedValue(htmlResponse(indexHtml))
    const wrapper = await openReleaseNotes()

    const dates = wrapper
      .findAll('.sr-news-list li')
      .filter((li) => li.text().includes('Server - '))
      .map((li) => li.find('.sr-news-date').text())
    expect(dates).toEqual(['2026-05-08', '2026-03-12', '2026-03-12', '2026-01-27', '2025-11-01'])

    // One request for the index, and nothing else: the old implementation
    // fetched every release page just to read a date out of it.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('resolves root-relative hrefs against the docs origin', async () => {
    fetchMock.mockResolvedValue(htmlResponse(indexHtml))
    const wrapper = await openReleaseNotes()

    fetchMock.mockResolvedValue(htmlResponse(detailHtml))
    await openServerNote(wrapper, 'Server - Release v5.4.x')

    expect(fetchMock).toHaveBeenLastCalledWith(
      `${DOCS_ORIGIN}/developer-guide/release-notes/release-2026-05-08-v05-04-00`
    )
    expect(wrapper.find('.sr-news-original-link').attributes('href')).toBe(
      `${DOCS_ORIGIN}/developer-guide/release-notes/release-2026-05-08-v05-04-00`
    )
  })
})

describe('release-notes detail parsing', () => {
  const openFirstServerNote = async () => {
    fetchMock.mockResolvedValue(htmlResponse(indexHtml))
    const wrapper = await openReleaseNotes()
    fetchMock.mockResolvedValue(htmlResponse(detailHtml))
    await openServerNote(wrapper, 'Server - Release v5.4.x')
    return wrapper
  }

  it('renders the article body', async () => {
    const wrapper = await openFirstServerNote()
    const text = wrapper.text()
    expect(text).toContain('Significant Changes')
    expect(text).toContain('generated OpenAPI specs')
  })

  it('strips MyST page chrome', async () => {
    const wrapper = await openFirstServerNote()
    const html = wrapper.html()
    expect(html).not.toContain('myst-fm-block-header')
    expect(html).not.toContain('myst-footer-links')
    expect(html).not.toContain('Edit')
    expect(wrapper.find('.sr-landing-panel-content').text()).not.toContain('¶')
  })

  it('rewrites relative links in the body to absolute docs URLs', async () => {
    const wrapper = await openFirstServerNote()
    const hrefs = wrapper.findAll('.sr-landing-panel-content a').map((a) => a.attributes('href'))
    expect(hrefs).toContain(`${DOCS_ORIGIN}/user-guide/icesat2`)
    expect(hrefs).toContain('https://github.com/SlideRuleEarth/sliderule/pull/608')
  })
})

describe('ordering', () => {
  it('breaks a same-date tie by version, newest first', async () => {
    // The fixture lists v5.2.x before v5.3.x, both dated 2026-03-12, so a
    // date-only sort would leave them in that (wrong) order -- issue #1102.
    fetchMock.mockResolvedValue(htmlResponse(indexHtml))
    const wrapper = await openReleaseNotes()

    const listed = rows(wrapper)
    const v53 = listed.findIndex((t) => t.includes('Release v5.3.x'))
    const v52 = listed.findIndex((t) => t.includes('Release v5.2.x'))
    expect(v53).toBeGreaterThanOrEqual(0)
    expect(v53).toBeLessThan(v52)
  })

  it('orders every same-date pair by descending version', async () => {
    // A property over the whole list, bundled web-client notes included, so it
    // keeps holding as releases are added.
    fetchMock.mockResolvedValue(htmlResponse(indexHtml))
    const wrapper = await openReleaseNotes()

    const entries = wrapper.findAll('.sr-news-list li').map((li) => ({
      date: li.find('.sr-news-date').text(),
      title: li.find('.sr-news-title').text()
    }))
    expect(entries.length).toBeGreaterThan(1)

    const sameDatePairs = entries
      .slice(1)
      .map((entry, i) => [entries[i], entry])
      .filter(([a, b]) => a.date === b.date)
    expect(sameDatePairs.length).toBeGreaterThan(0)

    for (const [a, b] of sameDatePairs) {
      expect(versionOf(a.title), `${a.title} should outrank ${b.title}`).toBeGreaterThan(
        versionOf(b.title)
      )
    }
  })
})

describe('docs-site failures', () => {
  it('keeps the bundled web-client notes visible when the index fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const wrapper = await openReleaseNotes()

    expect(wrapper.find('.sr-news-error').text()).toContain('Could not load server release notes')

    const listed = rows(wrapper)
    expect(listed.length).toBeGreaterThan(0)
    expect(listed.every((t) => t.includes('Web Client - '))).toBe(true)
  })

  it('keeps the list visible when a detail fetch fails', async () => {
    fetchMock.mockResolvedValue(htmlResponse(indexHtml))
    const wrapper = await openReleaseNotes()
    const before = rows(wrapper).length

    fetchMock.mockResolvedValue(new Response('', { status: 404 }))
    await openServerNote(wrapper, 'Server - Release v5.4.x')

    expect(wrapper.find('.sr-news-error').text()).toContain('Failed to load this release note')
    expect(rows(wrapper)).toHaveLength(before)
  })

  it('reports a failure when the response has no MyST article', async () => {
    fetchMock.mockResolvedValue(htmlResponse('<html><body><main>nothing here</main></body></html>'))
    const wrapper = await openReleaseNotes()

    expect(wrapper.find('.sr-news-error').exists()).toBe(true)
    expect(rows(wrapper).every((t) => t.includes('Web Client - '))).toBe(true)
  })
})
