// src/utils/importRequestToStore.ts
import { ICESat2RequestSchema } from '@/zod/ICESat2Schemas'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useRasterParamsStore } from '@/stores/rasterParamsStore'
import { applyParsedJsonToStores } from '@/utils/applyParsedJsonToStores'
import { createLogger } from '@/utils/logger'

const logger = createLogger('ImportRequestToStore')

// Issue categories for import field problems
/* eslint-disable no-unused-vars */
export enum ImportIssueCategory {
  IGNORED = 'IGNORED', // Field recognized but intentionally skipped (e.g., unrecognized beam values)
  INVALID = 'INVALID', // Field value was malformed and could not be applied
  ADJUSTED = 'ADJUSTED', // Field was converted/normalized (legacy names, polygon winding)
  UNKNOWN = 'UNKNOWN', // Field not recognized by the application at all
  API_MISMATCH = 'API_MISMATCH' // Field imported but won't be exported due to current API/settings selection
}
/* eslint-enable no-unused-vars */

export interface ImportIssue {
  message: string
  category: ImportIssueCategory
}

// All parameter keys that are recognized and processed by applyParsedJsonToStores
const KNOWN_PARMS_KEYS = new Set([
  // Polygon and granule selection
  'poly',
  'rgt',
  'cycle',
  'region',
  't0',
  't1',
  'beams',
  'tracks',
  // GEDI quality filters (current and legacy names)
  'degrade_filter',
  'degrade',
  'l2_quality_filter',
  'l2_quality',
  'l4_quality_filter',
  'l4_quality',
  'surface_flag',
  'surface',
  // Photon selection
  'cnf',
  'quality_ph',
  'srt',
  'cnt',
  'ats',
  // Field arrays
  'atl06_fields',
  'atl08_fields',
  'atl03_geo_fields',
  'atl03_corr_fields',
  'atl03_ph_fields',
  'atl13_fields',
  'gedi_fields',
  'anc_fields',
  // Processing parameters
  'len',
  'res',
  'pass_invalid',
  'max_resources',
  // Timeout parameters
  'timeout',
  'rqst-timeout',
  'node-timeout',
  'read-timeout',
  // Classification and algorithm settings
  'datum',
  'dist_in_seg',
  'atl08_class',
  'atl13',
  'atl24',
  'yapc',
  'fit',
  'phoreal',
  // Output and sampling
  'output',
  'samples',
  // Schema-defined but auto-handled
  'asset',
  'cmr',
  'track'
])

const userFacingIssues: Record<string, ImportIssue[]> = {}

function addIssue(section: string, message: string, category: ImportIssueCategory) {
  if (!userFacingIssues[section]) userFacingIssues[section] = []
  userFacingIssues[section].push({ message, category })
}

// Wrapper for backward compatibility with applyParsedJsonToStores
// Infers category from message content
function addError(section: string, message: string) {
  const category = inferCategory(message)
  addIssue(section, message, category)
}

function inferCategory(message: string): ImportIssueCategory {
  const lowerMsg = message.toLowerCase()
  // Check for API mismatch: field won't be exported due to API/settings selection
  if (lowerMsg.includes('only exported for') || lowerMsg.includes('may appear missing in diff')) {
    return ImportIssueCategory.API_MISMATCH
  }
  // Check for adjustments: polygon changes, param renames, type conversions
  if (
    lowerMsg.includes('adjusted') ||
    lowerMsg.includes('reordered') ||
    lowerMsg.includes('starting point') ||
    lowerMsg.includes('parameter name updated') ||
    lowerMsg.includes('converted to')
  ) {
    return ImportIssueCategory.ADJUSTED
  }
  // Check for "not recognized", "skipped" - these are ignored values
  if (lowerMsg.includes('not recognized') || lowerMsg.includes('skipped')) {
    return ImportIssueCategory.IGNORED
  }
  // Check for "invalid" - these are invalid values
  if (lowerMsg.includes('invalid')) {
    return ImportIssueCategory.INVALID
  }
  // Default to unknown if we can't categorize
  return ImportIssueCategory.UNKNOWN
}

type ToastFn = (_summary: string, _detail: string, _severity?: string) => void

// Group issues by category and format as text with headings
function formatGroupedIssues(issues: Record<string, ImportIssue[]>): string {
  // Group all issues by category
  const byCategory: Record<ImportIssueCategory, Array<{ field: string; message: string }>> = {
    [ImportIssueCategory.ADJUSTED]: [],
    [ImportIssueCategory.IGNORED]: [],
    [ImportIssueCategory.INVALID]: [],
    [ImportIssueCategory.UNKNOWN]: [],
    [ImportIssueCategory.API_MISMATCH]: []
  }

  for (const [field, fieldIssues] of Object.entries(issues)) {
    for (const issue of fieldIssues) {
      byCategory[issue.category].push({ field, message: issue.message })
    }
  }

  // Format with category headings
  const sections: string[] = []
  const categoryOrder: ImportIssueCategory[] = [
    ImportIssueCategory.API_MISMATCH,
    ImportIssueCategory.ADJUSTED,
    ImportIssueCategory.IGNORED,
    ImportIssueCategory.INVALID,
    ImportIssueCategory.UNKNOWN
  ]

  for (const category of categoryOrder) {
    const items = byCategory[category]
    if (items.length > 0) {
      const heading = `${category}:`
      // Format each item with field on one line and message indented below
      const lines = items.map((item) => `  ${item.field}:\n      ${item.message}`)
      sections.push([heading, ...lines].join('\n'))
    }
  }

  return sections.join('\n\n')
}

function showGroupedIssues(
  issues: Record<string, ImportIssue[]>,
  summary: string,
  fallbackDetail?: string,
  toastFn?: ToastFn
) {
  let detail: string

  if (Object.keys(issues).length > 0) {
    detail = formatGroupedIssues(issues)

    // Log detailed issue structure for debugging
    logger.debug('showGroupedIssues: Grouped issue details', {
      summary,
      issues,
      formattedDetail: detail
    })
  } else {
    detail = fallbackDetail ?? 'An unknown error occurred.'
    logger.debug('showGroupedIssues: No specific issues. Using fallback', {
      summary,
      fallbackDetail: detail
    })
  }

  if (toastFn) {
    toastFn(summary, detail, 'warn')
  } else {
    logger.warn('toast missing', { summary, detail })
  }
}

function flattenIssueObject(obj: Record<string, ImportIssue[]>): string[] {
  return Object.entries(obj).flatMap(([section, issues]) =>
    issues.map((issue) => `[${issue.category}] ${section}: ${issue.message}`)
  )
}

function detectUnknownKeys(data: Record<string, unknown>): string[] {
  return Object.keys(data).filter((key) => !KNOWN_PARMS_KEYS.has(key))
}

export function importRequestJsonToStore(
  json: unknown,
  toastFn?: ToastFn
): { success: boolean; errors?: string[] } {
  const store = useReqParamsStore()
  const rasterStore = useRasterParamsStore()

  // Reset issues before processing
  for (const key in userFacingIssues) {
    if (Object.prototype.hasOwnProperty.call(userFacingIssues, key)) {
      delete userFacingIssues[key]
    }
  }

  const result = ICESat2RequestSchema.safeParse(json)
  logger.debug('Zod validation', { json, result })

  if (!result.success) {
    result.error.errors.forEach((e) => {
      const key = e.path.join('.') || 'unknown'
      addIssue(key, e.message, ImportIssueCategory.INVALID)
    })
    showGroupedIssues(
      userFacingIssues,
      'Import Failed',
      'Please correct these issues in your JSON.',
      toastFn
    )
    return { success: false, errors: flattenIssueObject(userFacingIssues) }
  }

  const data = result.data.parms
  applyParsedJsonToStores(data, store, rasterStore, addError)

  // After importing, apply API-specific cleanup logic and warn about mismatches
  // This ensures consistency with the same logic used when switching APIs
  const selectedApi = store.iceSat2SelectedAPI

  // Detect API-specific params that were imported but don't match the selected API
  // These will be cleaned up when we call setIceSat2API
  if (data.fit !== undefined) {
    if (selectedApi !== 'atl03x-surface' && selectedApi !== 'atl06p') {
      addIssue(
        'fit',
        `The "fit" parameter was imported but will be ignored because the selected API is "${selectedApi}". Switch to "atl03x-surface" or "atl06p" to use surface fitting.`,
        ImportIssueCategory.API_MISMATCH
      )
    }
  }
  if (data.phoreal !== undefined) {
    if (selectedApi !== 'atl03x-phoreal' && selectedApi !== 'atl08p') {
      addIssue(
        'phoreal',
        `The "phoreal" parameter was imported but will be ignored because the selected API is "${selectedApi}". Switch to "atl03x-phoreal" or "atl08p" to use PhoREAL.`,
        ImportIssueCategory.API_MISMATCH
      )
    }
  }
  if (data.atl24 !== undefined) {
    if (selectedApi !== 'atl24x') {
      addIssue(
        'atl24',
        `The "atl24" parameter was imported but will be ignored because the selected API is "${selectedApi}". Switch to "atl24x" to use ATL24 classification.`,
        ImportIssueCategory.API_MISMATCH
      )
    }
  }
  if (data.atl13 !== undefined) {
    if (selectedApi !== 'atl13x') {
      addIssue(
        'atl13',
        `The "atl13" parameter was imported but will be ignored because the selected API is "${selectedApi}". Switch to "atl13x" to use ATL13 inland water.`,
        ImportIssueCategory.API_MISMATCH
      )
    }
  }

  // Apply API-specific cleanup by re-triggering the API selection logic
  // This resets all API-specific flags and enables only the appropriate ones
  store.setIceSat2API(selectedApi)
  logger.debug('Applied API-specific cleanup after import', { selectedApi })

  // Detect unknown top-level keys
  const unknownKeys = detectUnknownKeys(data)
  unknownKeys.forEach((key) => {
    addIssue(
      key,
      'Unrecognized parameter - this field is not supported',
      ImportIssueCategory.UNKNOWN
    )
  })

  if (Object.keys(userFacingIssues).length > 0) {
    showGroupedIssues(userFacingIssues, 'Some fields had issues during import', undefined, toastFn)
  }

  return {
    success: true,
    errors:
      Object.keys(userFacingIssues).length > 0 ? flattenIssueObject(userFacingIssues) : undefined
  }
}
