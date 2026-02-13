#!/usr/bin/env tsx
/**
 * build-docs-index.ts
 *
 * Scrapes SlideRule ReadTheDocs pages and extracts tooltip text from Vue
 * components to produce src/assets/docs-index.json.
 *
 * Usage:
 *   cd web-client
 *   npx tsx scripts/build-docs-index.ts
 *
 * Requirements:
 *   npm install --save-dev cheerio pdf-parse
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as cheerio from 'cheerio'
import { PDFParse } from 'pdf-parse'

// ── Configuration ────────────────────────────────────────────────

const __filename_esm = fileURLToPath(import.meta.url)
const __dirname_esm = path.dirname(__filename_esm)

const VUE_SRC_DIR = path.resolve(__dirname_esm, '../src')
const OUTPUT_FILE = path.resolve(__dirname_esm, '../src/assets/docs-index.json')

/** ReadTheDocs pages to scrape for bundled documentation */
const DOC_URLS = [
  'https://slideruleearth.io/web/rtd/',
  'https://slideruleearth.io/web/rtd/getting_started/',
  'https://slideruleearth.io/web/rtd/user_guide/icesat2.html',
  'https://slideruleearth.io/web/rtd/user_guide/photon_selection.html',
  'https://slideruleearth.io/web/rtd/user_guide/phoreal.html',
  'https://slideruleearth.io/web/rtd/user_guide/gedi.html',
  'https://slideruleearth.io/web/rtd/api_reference/icesat2.html',
  'https://slideruleearth.io/web/rtd/api_reference/gedi.html'
]

/** PDF documents to parse and index */
const PDF_URLS = [
  'https://nsidc.org/sites/default/files/documents/technical-reference/icesat2_atl03_atbd_v006.pdf',
  'https://nsidc.org/sites/default/files/documents/user-guide/atl03-v006-userguide.pdf'
]

const MAX_CHUNK_CHARS = 2000

// ── Types ────────────────────────────────────────────────────────

interface DocChunk {
  source: string
  section: string
  title: string
  content: string
  url: string
  tags: string
}

interface TooltipEntry {
  label: string
  component: string
  tooltipText: string
  tooltipUrl: string
}

// ── Tooltip extraction ───────────────────────────────────────────

function extractTooltipsFromVue(filePath: string): TooltipEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const entries: TooltipEntry[] = []

  // Match SrLabelInfoIconButton and similar components with tooltip props
  const componentRegex =
    /<(?:SrLabelInfoIconButton|SrMenuNumberInput|SrTextInput|SrCheckbox|SrSliderInput)[^>]*>/gs
  const matches = content.matchAll(componentRegex)

  for (const match of matches) {
    const tag = match[0]

    const labelMatch = tag.match(/label="([^"]*)"/)
    const tooltipTextMatch = tag.match(/tooltipText="([^"]*)"/)
    const tooltipUrlMatch = tag.match(/tooltipUrl="([^"]*)"/)

    if (labelMatch && tooltipTextMatch) {
      const componentName = path.basename(filePath, '.vue')
      entries.push({
        label: labelMatch[1],
        component: componentName,
        tooltipText: tooltipTextMatch[1],
        tooltipUrl: tooltipUrlMatch?.[1] ?? ''
      })
    }
  }

  return entries
}

function findVueFiles(dir: string): string[] {
  const results: string[] = []

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        walk(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.vue')) {
        results.push(fullPath)
      }
    }
  }

  walk(dir)
  return results
}

// ── ReadTheDocs scraping ─────────────────────────────────────────

async function fetchAndChunk(url: string): Promise<DocChunk[]> {
  console.log(`  Fetching ${url}...`)

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`  Warning: ${url} returned ${response.status}`)
      return []
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove navigation, headers, footers
    $('nav, header, footer, .sidebar, .toctree-wrapper').remove()

    // Get main content
    const main =
      $('main').length > 0 ? $('main') : $('article').length > 0 ? $('article') : $('body')
    const text = main.text().replace(/\s+/g, ' ').trim()

    if (!text || text.length < 50) {
      console.warn(`  Warning: ${url} had no substantial content`)
      return []
    }

    const title = $('h1').first().text().trim() || path.basename(url, '.html')
    const urlPath = new URL(url).pathname
    const section =
      urlPath
        .replace(/^\/web\/rtd\//, '')
        .replace(/\.html$/, '')
        .replace(/\/$/, '') || 'index'

    // Chunk the text
    const chunks = chunkText(text, MAX_CHUNK_CHARS)
    return chunks.map((content, i) => ({
      source: 'bundled',
      section: chunks.length > 1 ? `${section}/chunk${i + 1}` : section,
      title: chunks.length > 1 ? `${title} (part ${i + 1})` : title,
      content,
      url,
      tags: extractTags(section, title)
    }))
  } catch (e) {
    console.warn(`  Warning: Failed to fetch ${url}: ${e}`)
    return []
  }
}

function chunkText(text: string, maxChars: number): string[] {
  // Split on sentence boundaries roughly
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > maxChars && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks
}

function extractTags(section: string, title: string): string {
  const words = new Set<string>()
  for (const part of section.split('/')) {
    if (part.length > 1) words.add(part.toLowerCase())
  }
  for (const word of title.toLowerCase().split(/[\s/()-]+/)) {
    if (word.length > 2) words.add(word)
  }
  return [...words].join(',')
}

// ── PDF parsing ─────────────────────────────────────────────────

async function fetchAndChunkPdf(url: string): Promise<DocChunk[]> {
  console.log(`  Fetching PDF ${url}...`)

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`  Warning: ${url} returned ${response.status}`)
      return []
    }

    const buffer = await response.arrayBuffer()
    const pdf = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await pdf.getText()
    await pdf.destroy()
    const text = result.text.replace(/\s+/g, ' ').trim()

    if (!text || text.length < 50) {
      console.warn(`  Warning: ${url} had no substantial text`)
      return []
    }

    const filename = path.basename(new URL(url).pathname, '.pdf')
    const title = filename.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const section = `pdf/${filename}`

    const chunks = chunkText(text, MAX_CHUNK_CHARS)
    console.log(`    Extracted ${text.length} chars → ${chunks.length} chunks`)
    return chunks.map((content, i) => ({
      source: 'pdf',
      section: chunks.length > 1 ? `${section}/chunk${i + 1}` : section,
      title: chunks.length > 1 ? `${title} (part ${i + 1})` : title,
      content,
      url,
      tags: extractTags(section, title)
    }))
  } catch (e) {
    console.warn(`  Warning: Failed to parse PDF ${url}: ${e}`)
    return []
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('Building docs-index.json...\n')

  // 1. Extract tooltips from Vue components
  console.log('Scanning Vue components for tooltips...')
  const vueFiles = findVueFiles(VUE_SRC_DIR)
  const allTooltips: TooltipEntry[] = []

  for (const file of vueFiles) {
    const tooltips = extractTooltipsFromVue(file)
    allTooltips.push(...tooltips)
  }
  console.log(`  Found ${allTooltips.length} tooltip entries from ${vueFiles.length} files\n`)

  // Also collect unique tooltip URLs to scrape
  const tooltipUrls = new Set<string>()
  for (const t of allTooltips) {
    if (t.tooltipUrl && t.tooltipUrl.startsWith('http')) {
      tooltipUrls.add(t.tooltipUrl)
    }
  }

  // 2. Convert tooltips to doc chunks
  const tooltipChunks: DocChunk[] = allTooltips.map((t) => ({
    source: 'tooltip',
    section: `params/${t.label.toLowerCase().replace(/\s+/g, '_')}`,
    title: t.label,
    content: t.tooltipText,
    url: t.tooltipUrl || '',
    tags: `tooltip,${t.label.toLowerCase()},${t.component.toLowerCase()}`
  }))

  // 3. Scrape ReadTheDocs pages
  console.log('Scraping ReadTheDocs pages...')
  const allUrls = new Set([...DOC_URLS, ...tooltipUrls])
  const scrapedChunks: DocChunk[] = []

  for (const url of allUrls) {
    const chunks = await fetchAndChunk(url)
    scrapedChunks.push(...chunks)
  }
  console.log(`  Scraped ${scrapedChunks.length} chunks from ${allUrls.size} URLs\n`)

  // 4. Parse PDF documents
  console.log('Parsing PDF documents...')
  const pdfChunks: DocChunk[] = []
  for (const url of PDF_URLS) {
    const chunks = await fetchAndChunkPdf(url)
    pdfChunks.push(...chunks)
  }
  console.log(`  Parsed ${pdfChunks.length} chunks from ${PDF_URLS.length} PDFs\n`)

  // 5. Combine and deduplicate
  const allChunks = [...scrapedChunks, ...pdfChunks, ...tooltipChunks]
  console.log(
    `Total: ${allChunks.length} chunks (${scrapedChunks.length} scraped + ${pdfChunks.length} PDF + ${tooltipChunks.length} tooltips)`
  )

  // 5. Write output
  const output = {
    version: 1,
    generated_at: new Date().toISOString(),
    chunks: allChunks,
    tooltips: allTooltips
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n')
  console.log(`\nWritten to ${OUTPUT_FILE}`)
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
