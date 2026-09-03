// tests/unit/docLinks.spec.ts
//
// docs.slideruleearth.io moved from Sphinx to MyST (issue #1100), which broke
// every link in docLinks.ts at once: routes lost their .html suffix, path
// separators went from _ to -, and the numbered user-guide pages started
// prefixing heading ids with the section number.
//
// These tests check each link against tests/data/docs-anchors.json, a snapshot
// of the site's own cross-reference index. Refresh it with
// tests/data/regen-docs-anchors.sh when the docs site restructures again.
import { describe, it, expect } from 'vitest'
import { DOCS } from '@/utils/docLinks'
import anchors from '../data/docs-anchors.json'

const DOCS_ORIGIN = 'https://docs.slideruleearth.io'

const pages = anchors.pages as Record<string, string[]>

/** Every string in the DOCS map, as [dotted.key, url] pairs. */
function flatten(node: unknown, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k)
  )
}

const allLinks = flatten(DOCS)
const docsLinks = allLinks.filter(([, url]) => new URL(url).origin === DOCS_ORIGIN)

describe('docLinks', () => {
  it('has links to check', () => {
    expect(docsLinks.length).toBeGreaterThan(15)
  })

  it.each(allLinks)('%s is an absolute URL', (_key, url) => {
    expect(() => new URL(url)).not.toThrow()
    expect(new URL(url).protocol).toBe('https:')
  })

  it.each(docsLinks)('%s uses a MyST route, not a Sphinx one', (_key, url) => {
    const { pathname } = new URL(url)
    // Sphinx served /user_guide/icesat2.html; MyST serves /user-guide/icesat2.
    expect(pathname).not.toMatch(/\.html$/)
    expect(pathname).not.toContain('_')
  })

  it.each(docsLinks)('%s points at a page the docs site publishes', (_key, url) => {
    const { pathname } = new URL(url)
    // The release-notes children are generated per release, so the index page
    // is the only one this repo hardcodes; anything else must be a known page.
    expect(Object.keys(pages)).toContain(pathname.replace(/\/$/, '') || '/')
  })

  it.each(docsLinks.filter(([, url]) => new URL(url).hash))(
    '%s points at a heading the page actually has',
    (_key, url) => {
      const { pathname, hash } = new URL(url)
      expect(pages[pathname]).toContain(hash.slice(1))
    }
  )
})

describe('link targets', () => {
  it('sends each ancillary-field editor to its own endpoint section', () => {
    // These four differ only by section number, which is exactly the kind of
    // thing a copy-paste edit collapses by accident.
    const targets = Object.values(DOCS.ancillaryFields)
    expect(new Set(targets).size).toBe(targets.length)
  })
})
