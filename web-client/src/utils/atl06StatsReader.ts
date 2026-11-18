import { AwsClient } from 'aws4fetch'
import { parquetMetadataAsync, parquetRead, type AsyncBuffer, type DecodedArray } from 'hyparquet'
import { fetchS3AccessCredentials } from '@/utils/fetchUtils'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useS3CredentialsStore } from '@/stores/s3CredentialsStore'
import { cellIdToFaceIJ } from '@/utils/s2CellGrid'
import { createLogger } from '@/utils/logger'

const logger = createLogger('Atl06StatsReader')

const BUCKET_URL = 'https://sliderule-public.s3.us-west-2.amazonaws.com'
const REGION = 'us-west-2'
const PREFIX = 'atl06tv4/stats/'
const FILE_PATTERN = /^ATL06S_S([0-9A-F]{16})\.parquet$/

// ATL06S_S<level N cell>.parquet holds statistics for the level N + 7 cells inside it; files exist up to level 7
export const STAT_LEVEL_DELTA = 7
export const MAX_FILE_LEVEL = 7
export const TILE_SIDE = 1 << STAT_LEVEL_DELTA

// The footer (~115 KB, 217 columns) and cell_id (the last column) are at the end of the file, so one
// suffix read usually covers both; h_li_mean then costs one more ranged read.
const SUFFIX_BYTES = 256 * 1024
const WHOLE_FILE_BYTES = 384 * 1024
// Means that absorbed ATL06 fill values (3.4e38) are not heights
const MAX_VALID_HEIGHT = 1e5
const CREDENTIAL_MARGIN_MS = 5 * 60 * 1000

export class StatsAccessError extends Error {}

/** h_li_mean of the TILE_SIDE x TILE_SIDE stat cells of one file, indexed (i & mask) * TILE_SIDE + (j & mask); NaN where no data. */
export interface StatTile {
  values: Float32Array
}

let aws: { client: AwsClient; expires: number; source: string } | null = null
let awsPromise: Promise<AwsClient> | null = null
let listingPromise: Promise<Map<string, number> | null> | null = null

/** True when there is a way to get S3 credentials: logged in, or credentials pasted in Settings. */
export function hasStatsCredentials(): boolean {
  return useGitHubAuthStore().authToken !== null || useS3CredentialsStore().hasCredentials
}

// identifies the credentials in effect so a login, logout, or new paste replaces the cached client
function credentialSource(): string {
  const token = useGitHubAuthStore().authToken
  if (token) return `login:${token}`
  const pasted = useS3CredentialsStore()
  return pasted.hasCredentials ? `pasted:${pasted.accessKeyId}:${pasted.sessionToken}` : 'none'
}

function pastedClient(): AwsClient | null {
  const pasted = useS3CredentialsStore()
  if (!pasted.hasCredentials) return null
  return new AwsClient({
    accessKeyId: pasted.accessKeyId,
    secretAccessKey: pasted.secretAccessKey,
    sessionToken: pasted.sessionToken || undefined,
    service: 's3',
    region: REGION,
    retries: 1
  })
}

async function createAwsClient(source: string): Promise<AwsClient> {
  let error = 'Log in or enter S3 credentials in Settings'
  if (useGitHubAuthStore().authToken) {
    const result = await fetchS3AccessCredentials()
    if (result.success && result.data) {
      const c = result.data
      const client = new AwsClient({
        accessKeyId: c.access_key_id,
        secretAccessKey: c.secret_access_key,
        sessionToken: c.session_token,
        service: 's3',
        region: REGION,
        retries: 1
      })
      aws = { client, expires: Date.parse(c.expiration), source }
      return client
    }
    error = result.error ?? 'Unable to get S3 credentials'
  }
  // pasted credentials carry no expiration; S3 rejects them once they expire
  const client = pastedClient()
  if (!client) throw new StatsAccessError(error)
  aws = { client, expires: Infinity, source }
  return client
}

async function getAwsClient(): Promise<AwsClient> {
  const source = credentialSource()
  if (aws && aws.source === source && Date.now() < aws.expires - CREDENTIAL_MARGIN_MS) {
    return aws.client
  }
  if (aws && aws.source !== source) {
    aws = null
    listingPromise = null
  }
  if (!awsPromise) {
    awsPromise = createAwsClient(source).finally(() => {
      awsPromise = null
    })
  }
  return await awsPromise
}

// Query-string signing keeps Authorization/x-amz-* headers off the request, so a plain
// "bytes=a-b" Range read is a CORS simple request and needs no preflight.
async function presign(url: string): Promise<string> {
  const client = await getAwsClient()
  return (await client.sign(url, { method: 'GET', aws: { signQuery: true } })).url
}

async function getRange(url: string, range: string): Promise<Response> {
  return fetch(await presign(url), { headers: { Range: range } })
}

/**
 * Sizes of the existing stat files keyed by cell id hex, or null when the credentials
 * cannot list the bucket (affiliates get GetObject only).
 */
export async function listStatFiles(): Promise<Map<string, number> | null> {
  await getAwsClient() // drops a listing made with replaced credentials
  if (!listingPromise) {
    listingPromise = fetchListing().catch((error) => {
      listingPromise = null
      throw error
    })
  }
  return await listingPromise
}

async function fetchListing(): Promise<Map<string, number> | null> {
  const files = new Map<string, number>()
  let token: string | null = null
  do {
    let url = `${BUCKET_URL}/?list-type=2&prefix=${encodeURIComponent(PREFIX)}`
    if (token) url += `&continuation-token=${encodeURIComponent(token)}`
    const response = await fetch(await presign(url))
    if (response.status === 400 || response.status === 403) {
      const code = /<Code>([^<]+)<\/Code>/.exec(await response.text())?.[1]
      // AccessDenied: valid credentials without s3:ListBucket
      if (code === 'AccessDenied') return null
      throw new StatsAccessError(`S3 rejected the credentials (${code ?? response.status})`)
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} listing ${PREFIX}`)
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml')
    for (const contents of Array.from(xml.getElementsByTagName('Contents'))) {
      const key = contents.getElementsByTagName('Key')[0]?.textContent ?? ''
      const size = Number(contents.getElementsByTagName('Size')[0]?.textContent)
      const match = FILE_PATTERN.exec(key.slice(PREFIX.length))
      if (match && size > 0) files.set(match[1], size)
    }
    const truncated = xml.getElementsByTagName('IsTruncated')[0]?.textContent === 'true'
    token = truncated
      ? (xml.getElementsByTagName('NextContinuationToken')[0]?.textContent ?? null)
      : null
  } while (token)
  logger.debug('Listed stat files', { count: files.size })
  return files
}

/**
 * Read h_li_mean for the file of the level `fileLevel` cell `cellHex`. Returns null if the file
 * does not exist. `size` comes from the listing; without it a 403 is treated as a missing file.
 */
export async function readStatTile(
  cellHex: string,
  fileLevel: number,
  size: number | undefined
): Promise<StatTile | null> {
  const url = `${BUCKET_URL}/${PREFIX}ATL06S_S${cellHex}.parquet`
  let range: string
  if (size === undefined) range = `bytes=-${SUFFIX_BYTES}`
  else if (size <= WHOLE_FILE_BYTES) range = `bytes=0-${size - 1}`
  else range = `bytes=${size - SUFFIX_BYTES}-${size - 1}`

  const first = await getRange(url, range)
  if (first.status === 404 || (first.status === 403 && size === undefined)) return null
  if (first.status === 400 || first.status === 403) {
    throw new StatsAccessError('S3 credentials expired or were rejected')
  }
  if (!first.ok) throw new Error(`HTTP ${first.status} reading ${url}`)
  const tail = await first.arrayBuffer()
  const total = Number(first.headers.get('Content-Range')?.split('/')[1])
  const byteLength =
    first.status === 200 ? tail.byteLength : (size ?? (total > 0 ? total : tail.byteLength))
  const tailStart = byteLength - tail.byteLength

  const file: AsyncBuffer = {
    byteLength,
    slice: async (start: number, end: number = byteLength) => {
      if (start >= tailStart) return tail.slice(start - tailStart, end - tailStart)
      const response = await getRange(url, `bytes=${start}-${end - 1}`)
      if (!response.ok) throw new Error(`HTTP ${response.status} reading ${url}`)
      return response.arrayBuffer()
    }
  }

  const metadata = await parquetMetadataAsync(file, {
    initialFetchSize: tail.byteLength,
    geoparquet: false
  })
  const ids = new Map<number, DecodedArray>()
  const heights = new Map<number, DecodedArray>()
  await parquetRead({
    file,
    metadata,
    columns: ['cell_id', 'h_li_mean'],
    geoparquet: false,
    onChunk: ({ columnName, columnData, rowStart }) => {
      ;(columnName === 'cell_id' ? ids : heights).set(rowStart, columnData)
    }
  })

  const tile: StatTile = { values: new Float32Array(TILE_SIDE * TILE_SIDE).fill(NaN) }
  for (const [rowStart, idChunk] of ids) {
    const heightChunk = heights.get(rowStart)
    if (heightChunk) fillTile(tile, idChunk, heightChunk, fileLevel + STAT_LEVEL_DELTA)
  }
  return tile
}

export function fillTile(
  tile: StatTile,
  ids: DecodedArray,
  heights: DecodedArray,
  statLevel: number
): void {
  const mask = TILE_SIDE - 1
  const faceIJ = new Int32Array(3)
  // reading the uint64 ids as little-endian 32-bit word pairs avoids per-row BigInt math
  const words =
    ids instanceof BigUint64Array || ids instanceof BigInt64Array
      ? new Uint32Array(ids.buffer, ids.byteOffset, ids.length * 2)
      : null
  const n = Math.min(ids.length, heights.length)
  for (let r = 0; r < n; r++) {
    const raw = heights[r]
    if (raw === null || raw === undefined) continue
    const h = Number(raw)
    if (!(Math.abs(h) < MAX_VALID_HEIGHT)) continue
    let hi: number
    let lo: number
    if (words) {
      lo = words[2 * r]
      hi = words[2 * r + 1]
    } else {
      if (ids[r] === null || ids[r] === undefined) continue
      const id = BigInt.asUintN(64, BigInt(ids[r]))
      hi = Number(id >> 32n)
      lo = Number(id & 0xffffffffn)
    }
    cellIdToFaceIJ(hi, lo, statLevel, faceIJ)
    tile.values[(faceIJ[1] & mask) * TILE_SIDE + (faceIJ[2] & mask)] = h
  }
}
