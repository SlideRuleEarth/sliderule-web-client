import { createLogger } from '@/utils/logger'
import { createDuckDbClient } from '@/utils/SrDuckDb'
import docsIndex from '@/assets/docs-index.json'

const logger = createLogger('DocSearchEngine')

// ── Types ────────────────────────────────────────────────────────

interface DocChunk {
  id: number
  source: string
  section: string
  title: string
  content: string
  url: string
  tags: string
}

export interface SearchResult {
  id: number
  title: string
  section: string
  content: string
  url: string
  score: number
}

export interface ParamHelpResult {
  param_name: string
  tooltip: string | null
  defaults: Record<string, unknown> | null
  doc_url: string | null
  related_chunks: Array<{ title: string; content: string; section: string; url: string }>
}

// ── State ────────────────────────────────────────────────────────

let _initialized = false
let _initPromise: Promise<void> | null = null
let _hasFts = false
let _nextId = 1

// ── Public API ───────────────────────────────────────────────────

export function isInitialized(): boolean {
  return _initialized
}

export async function ensureInitialized(): Promise<void> {
  if (_initialized) return
  if (_initPromise) return await _initPromise
  _initPromise = initDocSearchEngine()
  return await _initPromise
}

export async function initDocSearchEngine(): Promise<void> {
  if (_initialized) return
  logger.info('Initializing documentation search engine')

  const client = await createDuckDbClient()

  // Create the sr_docs table
  await client.query(`
    CREATE TABLE IF NOT EXISTS sr_docs (
      id INTEGER PRIMARY KEY,
      source VARCHAR,
      section VARCHAR,
      title VARCHAR,
      content VARCHAR,
      url VARCHAR,
      tags VARCHAR,
      indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Load bundled docs
  const chunks = docsIndex.chunks ?? []
  if (chunks.length > 0) {
    await insertChunks(
      client,
      chunks.map((c) => ({
        source: c.source,
        section: c.section,
        title: c.title,
        content: c.content,
        url: c.url,
        tags: c.tags
      }))
    )
    logger.info(`Loaded ${chunks.length} bundled doc chunks`)
  }

  // Try to load FTS extension and build index.
  // DuckDB WASM's FTS is unreliable — the extension may load but the index
  // may not work.  We verify with a test query and fall back to ILIKE if
  // anything goes wrong.
  try {
    await client.query(`INSTALL fts`)
    await client.query(`LOAD fts`)
    await rebuildFtsIndex(client)
    // Verify the index actually works with a test query
    await client.query(
      `SELECT fts_main_sr_docs.match_bm25(id, 'test') AS score FROM sr_docs LIMIT 1`
    )
    _hasFts = true
    logger.info('FTS extension loaded and verified')
  } catch (e) {
    _hasFts = false
    logger.info('FTS not available in this environment, using ILIKE search', e)
  }

  _initialized = true
  logger.info('Documentation search engine initialized', { hasFts: _hasFts, chunks: chunks.length })
}

export async function searchDocs(query: string, maxResults = 10): Promise<SearchResult[]> {
  const client = await createDuckDbClient()

  if (_hasFts) {
    try {
      return await searchWithFts(client, query, maxResults)
    } catch (e) {
      logger.warn('FTS search failed, falling back to ILIKE search', e)
      _hasFts = false
    }
  }
  return searchWithFallback(client, query, maxResults)
}

export async function fetchAndIndexUrl(
  url: string
): Promise<{ chunkCount: number; sections: string[] }> {
  if (!url.includes('slideruleearth.io')) {
    throw new Error('URL must be under slideruleearth.io domain')
  }

  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new Error(
      `Cannot fetch ${url}: blocked by CORS. ` +
        'The ReadTheDocs server does not allow cross-origin requests. ' +
        'Use search_docs to search the bundled documentation instead.'
    )
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Extract text from main content area
  const main = doc.querySelector('main') ?? doc.querySelector('article') ?? doc.body
  const text = main?.textContent?.trim() ?? ''

  if (!text) {
    throw new Error('No text content found on page')
  }

  // Derive section from URL path
  const urlPath = new URL(url).pathname
  const section = urlPath
    .replace(/^\/web\/rtd\//, '')
    .replace(/\.html$/, '')
    .replace(/\//g, '/')
    .replace(/\/$/, '')

  const title = doc.querySelector('h1')?.textContent?.trim() ?? section

  // Chunk the text
  const chunks = chunkText(text, 2000)
  const chunkData = chunks.map((content, i) => ({
    source: 'live' as const,
    section: chunks.length > 1 ? `${section}/chunk${i + 1}` : section,
    title: chunks.length > 1 ? `${title} (part ${i + 1})` : title,
    content,
    url,
    tags: extractTags(section, title)
  }))

  const client = await createDuckDbClient()
  await insertChunks(client, chunkData)

  // Rebuild FTS index
  if (_hasFts) {
    await rebuildFtsIndex(client)
  }

  const sections = [...new Set(chunkData.map((c) => c.section))]
  return { chunkCount: chunkData.length, sections }
}

export async function getParamHelp(paramName: string): Promise<ParamHelpResult | null> {
  const client = await createDuckDbClient()
  const searchName = paramName.toLowerCase()

  // Search for chunks mentioning this parameter
  const result = await client.query(`
    SELECT id, title, content, section, url
    FROM sr_docs
    WHERE LOWER(tags) LIKE '%${escapeSql(searchName)}%'
       OR LOWER(section) LIKE '%${escapeSql(searchName)}%'
       OR LOWER(content) LIKE '%${escapeSql(searchName)}%'
    LIMIT 10
  `)

  const relatedChunks: Array<{ title: string; content: string; section: string; url: string }> = []
  for await (const chunk of result.readRows()) {
    for (const row of chunk) {
      const r = row as Record<string, unknown>
      relatedChunks.push({
        title: String(r.title ?? ''),
        content: String(r.content ?? '').substring(0, 500),
        section: String(r.section ?? ''),
        url: String(r.url ?? '')
      })
    }
  }

  if (relatedChunks.length === 0) return null

  // Try to get defaults for this param
  let defaults: Record<string, unknown> | null = null
  try {
    const { useSlideruleDefaults } = await import('@/stores/defaultsStore')
    const store = useSlideruleDefaults()
    if (store.fetched) {
      const allDefaults = store.getDefaults()
      if (allDefaults) {
        defaults = findParamInDefaults(allDefaults, searchName)
      }
    }
  } catch {
    // Defaults not available
  }

  // Find tooltip text (from tooltips in bundled index)
  let tooltip: string | null = null
  let docUrl: string | null = null
  const tooltips = docsIndex.tooltips ?? []
  for (const t of tooltips) {
    if (t.label?.toLowerCase() === searchName) {
      tooltip = t.tooltipText ?? null
      docUrl = t.tooltipUrl ?? null
      break
    }
  }

  return {
    param_name: paramName,
    tooltip,
    defaults,
    doc_url: docUrl ?? relatedChunks[0]?.url ?? null,
    related_chunks: relatedChunks
  }
}

export async function listDocSections(): Promise<
  Array<{ section: string; title: string; chunkCount: number }>
> {
  const client = await createDuckDbClient()
  const result = await client.query(`
    SELECT section, MIN(title) as title, COUNT(*) as chunk_count
    FROM sr_docs
    GROUP BY section
    ORDER BY section
  `)

  const sections: Array<{ section: string; title: string; chunkCount: number }> = []
  for await (const chunk of result.readRows()) {
    for (const row of chunk) {
      const r = row as Record<string, unknown>
      sections.push({
        section: String(r.section ?? ''),
        title: String(r.title ?? ''),
        chunkCount: Number(r.chunk_count ?? 0)
      })
    }
  }
  return sections
}

export async function getDocsIndex(): Promise<DocChunk[]> {
  const client = await createDuckDbClient()
  const result = await client.query(`SELECT * FROM sr_docs ORDER BY section, id`)

  const chunks: DocChunk[] = []
  for await (const chunk of result.readRows()) {
    for (const row of chunk) {
      const r = row as Record<string, unknown>
      chunks.push({
        id: Number(r.id ?? 0),
        source: String(r.source ?? ''),
        section: String(r.section ?? ''),
        title: String(r.title ?? ''),
        content: String(r.content ?? ''),
        url: String(r.url ?? ''),
        tags: String(r.tags ?? '')
      })
    }
  }
  return chunks
}

export async function getDocSection(section: string): Promise<DocChunk[]> {
  const client = await createDuckDbClient()
  const result = await client.query(`
    SELECT * FROM sr_docs
    WHERE section = '${escapeSql(section)}'
       OR section LIKE '${escapeSql(section)}/%'
    ORDER BY id
  `)

  const chunks: DocChunk[] = []
  for await (const chunk of result.readRows()) {
    for (const row of chunk) {
      const r = row as Record<string, unknown>
      chunks.push({
        id: Number(r.id ?? 0),
        source: String(r.source ?? ''),
        section: String(r.section ?? ''),
        title: String(r.title ?? ''),
        content: String(r.content ?? ''),
        url: String(r.url ?? ''),
        tags: String(r.tags ?? '')
      })
    }
  }
  return chunks
}

// ── Internal helpers ─────────────────────────────────────────────

function escapeSql(s: string): string {
  return s.replace(/'/g, "''")
}

async function insertChunks(
  client: Awaited<ReturnType<typeof createDuckDbClient>>,
  chunks: Array<{
    source: string
    section: string
    title: string
    content: string
    url: string
    tags: string
  }>
): Promise<void> {
  for (const c of chunks) {
    await client.query(`
      INSERT INTO sr_docs (id, source, section, title, content, url, tags)
      VALUES (${_nextId++}, '${escapeSql(c.source)}', '${escapeSql(c.section)}',
              '${escapeSql(c.title)}', '${escapeSql(c.content)}',
              '${escapeSql(c.url)}', '${escapeSql(c.tags)}')
    `)
  }
}

async function rebuildFtsIndex(
  client: Awaited<ReturnType<typeof createDuckDbClient>>
): Promise<void> {
  try {
    await client.query(`PRAGMA drop_fts_index('sr_docs')`)
  } catch {
    // Index may not exist yet
  }
  await client.query(`PRAGMA create_fts_index('sr_docs', 'id', 'title', 'content', 'tags')`)
  logger.debug('FTS index rebuilt')
}

async function searchWithFts(
  client: Awaited<ReturnType<typeof createDuckDbClient>>,
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  const result = await client.query(`
    SELECT s.id, s.title, s.section, s.content, s.url,
           fts_main_sr_docs.match_bm25(s.id, '${escapeSql(query)}') AS score
    FROM sr_docs s
    WHERE score IS NOT NULL
    ORDER BY score DESC
    LIMIT ${maxResults}
  `)

  const results: SearchResult[] = []
  for await (const chunk of result.readRows()) {
    for (const row of chunk) {
      const r = row as Record<string, unknown>
      results.push({
        id: Number(r.id ?? 0),
        title: String(r.title ?? ''),
        section: String(r.section ?? ''),
        content: String(r.content ?? '').substring(0, 500),
        url: String(r.url ?? ''),
        score: Number(r.score ?? 0)
      })
    }
  }
  return results
}

async function searchWithFallback(
  client: Awaited<ReturnType<typeof createDuckDbClient>>,
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  // Split query into tokens for multi-word matching
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1)
  if (tokens.length === 0) return []

  // Build scoring expression: title matches worth 3, tags worth 2, content worth 1
  const scoreParts: string[] = []
  const whereParts: string[] = []

  for (const token of tokens) {
    const escaped = escapeSql(token)
    scoreParts.push(
      `(CASE WHEN LOWER(title) LIKE '%${escaped}%' THEN 3 ELSE 0 END)`,
      `(CASE WHEN LOWER(tags) LIKE '%${escaped}%' THEN 2 ELSE 0 END)`,
      `(CASE WHEN LOWER(content) LIKE '%${escaped}%' THEN 1 ELSE 0 END)`
    )
    whereParts.push(
      `(LOWER(title) LIKE '%${escaped}%' OR LOWER(tags) LIKE '%${escaped}%' OR LOWER(content) LIKE '%${escaped}%')`
    )
  }

  const scoreExpr = scoreParts.join(' + ')
  const whereExpr = whereParts.join(' OR ')

  const result = await client.query(`
    SELECT id, title, section, content, url,
           (${scoreExpr}) AS score
    FROM sr_docs
    WHERE ${whereExpr}
    ORDER BY score DESC
    LIMIT ${maxResults}
  `)

  const results: SearchResult[] = []
  for await (const chunk of result.readRows()) {
    for (const row of chunk) {
      const r = row as Record<string, unknown>
      results.push({
        id: Number(r.id ?? 0),
        title: String(r.title ?? ''),
        section: String(r.section ?? ''),
        content: String(r.content ?? '').substring(0, 500),
        url: String(r.url ?? ''),
        score: Number(r.score ?? 0)
      })
    }
  }
  return results
}

function chunkText(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    if (current.length + trimmed.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim())
      current = trimmed
    } else {
      current += (current ? '\n\n' : '') + trimmed
    }
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  // If nothing was chunked (single long text), split by character limit
  if (chunks.length === 0 && text.trim()) {
    const trimmed = text.trim()
    for (let i = 0; i < trimmed.length; i += maxChars) {
      chunks.push(trimmed.substring(i, i + maxChars))
    }
  }

  return chunks
}

function extractTags(section: string, title: string): string {
  const words = new Set<string>()
  // Extract from section path
  for (const part of section.split('/')) {
    if (part.length > 1) words.add(part.toLowerCase())
  }
  // Extract key terms from title
  for (const word of title.toLowerCase().split(/[\s/()-]+/)) {
    if (word.length > 2) words.add(word)
  }
  return [...words].join(',')
}

function findParamInDefaults(
  defaults: Record<string, unknown>,
  paramName: string
): Record<string, unknown> | null {
  const result: Record<string, unknown> = {}

  function walk(obj: unknown, path: string): void {
    if (obj === null || obj === undefined) return
    if (typeof obj !== 'object') return

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const currentPath = path ? `${path}.${key}` : key
      if (key.toLowerCase() === paramName) {
        result[currentPath] = value
      }
      if (typeof value === 'object' && value !== null) {
        walk(value, currentPath)
      }
    }
  }

  walk(defaults, '')
  return Object.keys(result).length > 0 ? result : null
}
