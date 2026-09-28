// tests/unit/metaRequestLimit.spec.ts
/**
 * Servers from v5.6.1 store {} in place of a request over 1 MiB in the "meta" parquet
 * metadata (#1118). These tests cover the client code that reads that request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { dbGetRequest, dbGetFilename, dbUpdateRequestRecord, duckGetJsonMetaDataForKey } =
  vi.hoisted(() => ({
    dbGetRequest: vi.fn(),
    dbGetFilename: vi.fn(),
    dbUpdateRequestRecord: vi.fn(),
    duckGetJsonMetaDataForKey: vi.fn()
  }))

vi.mock('@/db/SlideRuleDb', () => ({
  db: {
    getRequest: dbGetRequest,
    getFilename: dbGetFilename,
    updateRequestRecord: dbUpdateRequestRecord
  }
}))

vi.mock('@/utils/SrDuckDb', () => ({
  createDuckDbClient: vi.fn().mockResolvedValue({
    insertOpfsParquet: vi.fn(),
    getJsonMetaDataForKey: duckGetJsonMetaDataForKey
  })
}))

import { getXSeriesImportInfo, updateReqParmsFromMeta } from '@/utils/SrParquetUtils'

// The request stored in tests/data/atl03x-surface_TestParquetFile_001.parquet
const surfaceRequest = {
  asset: 'icesat2',
  poly: [
    { lon: -76.859647981809, lat: 39.000471967112 },
    { lon: -76.859647981809, lat: 38.993080365136 },
    { lon: -76.835251597833, lat: 38.993080365136 },
    { lon: -76.835251597833, lat: 39.000471967112 },
    { lon: -76.859647981809, lat: 39.000471967112 }
  ],
  fit: [],
  output: { with_checksum: false, as_geo: false, format: 'parquet' }
}

const recordInfo = (z: string) =>
  JSON.stringify({ time: 'time_ns', x: 'longitude', y: 'latitude', z })

describe('getXSeriesImportInfo', () => {
  it('returns nothing for legacy files without meta', () => {
    expect(getXSeriesImportInfo(undefined, recordInfo('h_mean'))).toEqual({})
  })

  it('reads a surface fit from the stored request', () => {
    const meta = { endpoint: 'atl03x', srctbl: {}, request: surfaceRequest }
    expect(getXSeriesImportInfo(meta, recordInfo('h_mean'))).toEqual({
      endpoint: 'atl03x',
      hasFit: true,
      hasPhoReal: false
    })
  })

  it('reads PhoREAL from the stored request', () => {
    const meta = { endpoint: 'atl03x', request: { asset: 'icesat2', phoreal: {} } }
    expect(getXSeriesImportInfo(meta, recordInfo('h_canopy'))).toEqual({
      endpoint: 'atl03x',
      hasFit: false,
      hasPhoReal: true
    })
  })

  it('prefers the stored request over recordinfo', () => {
    const meta = { endpoint: 'atl03x', request: { asset: 'icesat2' } }
    expect(getXSeriesImportInfo(meta, recordInfo('h_mean'))).toMatchObject({ hasFit: false })
  })

  it('does not throw when the stored request is not an object', () => {
    const meta = { endpoint: 'atl03x', request: '{"fit": []' }
    expect(getXSeriesImportInfo(meta, recordInfo('h_mean'))).toMatchObject({ hasFit: true })
  })

  describe('when the server stored {} for the request', () => {
    const meta = { endpoint: 'atl03x', srctbl: {}, request: {} }

    it('detects a surface fit from recordinfo z = h_mean', () => {
      expect(getXSeriesImportInfo(meta, recordInfo('h_mean'))).toEqual({
        endpoint: 'atl03x',
        hasFit: true,
        hasPhoReal: false
      })
    })

    it('detects PhoREAL from recordinfo z = h_canopy', () => {
      expect(getXSeriesImportInfo(meta, recordInfo('h_canopy'))).toEqual({
        endpoint: 'atl03x',
        hasFit: false,
        hasPhoReal: true
      })
    })

    it('treats recordinfo z = height as plain atl03x', () => {
      expect(getXSeriesImportInfo(meta, recordInfo('height'))).toEqual({
        endpoint: 'atl03x',
        hasFit: false,
        hasPhoReal: false
      })
    })

    it('treats missing or unparsable recordinfo as plain atl03x', () => {
      const plain = { hasFit: false, hasPhoReal: false }
      expect(getXSeriesImportInfo(meta, undefined)).toMatchObject(plain)
      expect(getXSeriesImportInfo(meta, '{not json')).toMatchObject(plain)
    })

    it('only uses recordinfo for atl03x', () => {
      const atl06xMeta = { endpoint: 'atl06x', request: {} }
      expect(getXSeriesImportInfo(atl06xMeta, recordInfo('h_mean'))).toEqual({
        endpoint: 'atl06x',
        hasFit: false,
        hasPhoReal: false
      })
    })
  })
})

describe('updateReqParmsFromMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbGetRequest.mockResolvedValue({ req_id: 7, func: 'atl03x-surface' })
    dbGetFilename.mockResolvedValue('atl03x-surface_7.parquet')
  })

  it('stores the request from meta as rcvd_parms', async () => {
    duckGetJsonMetaDataForKey.mockResolvedValue({
      parsedMetadata: { endpoint: 'atl03x', request: surfaceRequest }
    })
    await updateReqParmsFromMeta(7)
    expect(dbUpdateRequestRecord).toHaveBeenCalledWith({ req_id: 7, rcvd_parms: surfaceRequest })
  })

  it('leaves rcvd_parms unset when the server stored {}', async () => {
    duckGetJsonMetaDataForKey.mockResolvedValue({
      parsedMetadata: { endpoint: 'atl03x', request: {} }
    })
    await updateReqParmsFromMeta(7)
    expect(dbUpdateRequestRecord).not.toHaveBeenCalled()
  })
})
