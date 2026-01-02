/**
 * Unit tests for SlideRuleDb parsing functions
 *
 * These tests verify that getSvrReqPoly correctly handles both:
 * - JSON string format (from duckDbLoadOpfsParquetFile)
 * - Already-parsed object format (from Dexie middleware or different code paths)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db, type SrRequestRecord } from '@/db/SlideRuleDb'
import type { SrRegion } from '@/types/SrTypes'

// Mock the logger to prevent console noise during tests
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('SlideRuleDb.getSvrReqPoly', () => {
  let mockRequest: SrRequestRecord

  // Sample poly data that would be returned
  const samplePoly: SrRegion = [
    { lat: 39.0, lon: -108.05 },
    { lat: 39.0, lon: -108.0 },
    { lat: 39.05, lon: -108.0 },
    { lat: 39.05, lon: -108.05 },
    { lat: 39.0, lon: -108.05 }
  ]

  // Sample svr_parms with modern server format
  const svrParmsWithServer = {
    server: {
      rqst: {
        parms: {
          poly: samplePoly
        }
      }
    }
  }

  // Sample svr_parms with direct poly format (atl24x style)
  const svrParmsWithDirectPoly = {
    poly: samplePoly
  }

  beforeEach(() => {
    mockRequest = {
      req_id: 123,
      status: 'success',
      svr_parms: undefined
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('svr_parms format handling', () => {
    it('should handle svr_parms as JSON string (server format)', async () => {
      // Set svr_parms as a JSON string (as returned from duckDbLoadOpfsParquetFile)
      mockRequest.svr_parms = JSON.stringify(svrParmsWithServer) as any

      // Mock the requests.get method
      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      const result = await db.getSvrReqPoly(123)

      expect(result).toEqual(samplePoly)
    })

    it('should handle svr_parms as already-parsed object (server format)', async () => {
      // Set svr_parms as an already-parsed object
      mockRequest.svr_parms = svrParmsWithServer as any

      // Mock the requests.get method
      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      const result = await db.getSvrReqPoly(123)

      expect(result).toEqual(samplePoly)
    })

    it('should handle svr_parms as JSON string (direct poly format)', async () => {
      // Set svr_parms as a JSON string with direct poly
      mockRequest.svr_parms = JSON.stringify(svrParmsWithDirectPoly) as any

      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      const result = await db.getSvrReqPoly(123)

      expect(result).toEqual(samplePoly)
    })

    it('should handle svr_parms as already-parsed object (direct poly format)', async () => {
      // Set svr_parms as an already-parsed object with direct poly
      mockRequest.svr_parms = svrParmsWithDirectPoly as any

      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      const result = await db.getSvrReqPoly(123)

      expect(result).toEqual(samplePoly)
    })

    it('should NOT throw "[object Object] is not valid JSON" error for object input', async () => {
      // This is the specific regression test for the bug fix
      // Before the fix, passing an object would cause JSON.parse to fail with
      // "[object Object]" is not valid JSON because JavaScript toString() was called first
      mockRequest.svr_parms = svrParmsWithServer as any

      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      // Should not throw any error
      await expect(db.getSvrReqPoly(123)).resolves.not.toThrow()

      const result = await db.getSvrReqPoly(123)
      expect(result).toEqual(samplePoly)
    })

    it('should return empty object when svr_parms is empty', async () => {
      mockRequest.svr_parms = undefined

      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      const result = await db.getSvrReqPoly(123)

      expect(result).toEqual({})
    })

    it('should return empty object when svr_parms has no poly', async () => {
      mockRequest.svr_parms = { someOtherField: 'value' } as any

      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      const result = await db.getSvrReqPoly(123)

      expect(result).toEqual({})
    })

    it('should return empty object for invalid JSON string', async () => {
      mockRequest.svr_parms = 'not valid json{' as any

      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      const result = await db.getSvrReqPoly(123)

      // Should return empty object instead of throwing
      expect(result).toEqual({})
    })

    it('should handle nested server.rqst.parms structure with string input', async () => {
      const nestedParms = {
        server: {
          rqst: {
            parms: {
              poly: samplePoly,
              otherParam: 'value'
            }
          }
        }
      }

      mockRequest.svr_parms = JSON.stringify(nestedParms) as any

      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      const result = await db.getSvrReqPoly(123)

      expect(result).toEqual(samplePoly)
    })

    it('should handle nested server.rqst.parms structure with object input', async () => {
      const nestedParms = {
        server: {
          rqst: {
            parms: {
              poly: samplePoly,
              otherParam: 'value'
            }
          }
        }
      }

      mockRequest.svr_parms = nestedParms as any

      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      const result = await db.getSvrReqPoly(123)

      expect(result).toEqual(samplePoly)
    })
  })

  describe('error status handling', () => {
    it('should still work for failed requests with object svr_parms', async () => {
      mockRequest.status = 'error'
      mockRequest.svr_parms = svrParmsWithServer as any

      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      const result = await db.getSvrReqPoly(123)

      expect(result).toEqual(samplePoly)
    })

    it('should still work for pending requests with string svr_parms', async () => {
      mockRequest.status = 'pending'
      mockRequest.svr_parms = JSON.stringify(svrParmsWithServer) as any

      vi.spyOn(db.requests, 'get').mockResolvedValue(mockRequest)

      const result = await db.getSvrReqPoly(123)

      expect(result).toEqual(samplePoly)
    })
  })
})
