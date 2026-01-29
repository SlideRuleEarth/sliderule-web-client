import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db as indexedDB } from '@/db/SlideRuleDb'
import { createDuckDbClient } from '@/utils/SrDuckDb'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrcIdTblStore')

export const useSrcIdTblStore = defineStore('srcIdTblStore', () => {
  // Map to store multiple source tables keyed by reqId
  const sourceTables = ref<Map<number, string[]>>(new Map())

  // Legacy support: keep sourceTable for backward compatibility
  const sourceTable = ref<string[]>([])

  async function setSrcIdTblWithFileName(fileName: string, reqId?: number) {
    const db = await createDuckDbClient()
    if (!db) {
      logger.error('Failed to create DuckDB client for file', { fileName })
      if (reqId !== undefined) {
        sourceTables.value.set(reqId, [])
      }
      sourceTable.value = []
      return
    }
    await db.insertOpfsParquet(fileName)
    try {
      const parsed = (await db.getJsonMetaDataForKey('meta', fileName)).parsedMetadata
      if (parsed && parsed.srctbl && typeof parsed.srctbl === 'object') {
        // Convert object with numeric keys to an array
        const srcArray = Object.values(parsed.srctbl) as string[]
        if (reqId !== undefined) {
          sourceTables.value.set(reqId, srcArray)
        }
        sourceTable.value = srcArray
      } else {
        if (reqId !== undefined) {
          sourceTables.value.set(reqId, [])
        }
        sourceTable.value = []
        logger.warn('setSrcIdTblWithFileName: Missing or invalid srctbl field in JSON', {
          fileName
        })
      }
    } catch (error) {
      // If meta metadata is not found, just log and continue with empty source table
      logger.warn(
        'setSrcIdTblWithFileName: Could not load meta metadata, source table will be empty',
        {
          fileName,
          error: error instanceof Error ? error.message : String(error)
        }
      )
      if (reqId !== undefined) {
        sourceTables.value.set(reqId, [])
      }
      sourceTable.value = []
    }
  }

  async function setSourceTbl(reqId: number) {
    const fileName = await indexedDB.getFilename(reqId)
    return setSrcIdTblWithFileName(fileName, reqId)
  }

  async function getUniqueSourceCount(req_id: number): Promise<number> {
    await setSourceTbl(req_id)
    const table = sourceTables.value.get(req_id) || []
    return new Set(table).size
  }

  async function getTotalSourceCount(req_id: number): Promise<number> {
    await setSourceTbl(req_id)
    const table = sourceTables.value.get(req_id) || []
    return table.length
  }

  async function getSourceCounts(req_id: number): Promise<{ unique: number; total: number }> {
    await setSourceTbl(req_id)
    const table = sourceTables.value.get(req_id) || []
    return {
      unique: new Set(table).size,
      total: table.length
    }
  }

  /**
   * Get the count of granules that actually have data in the elevation table
   * vs the total unique granules available in the srcid table.
   * @returns usedInData = unique granule names with data, availableInSrcTbl = unique granule names in srctbl
   */
  async function getGranuleCounts(
    req_id: number
  ): Promise<{ usedInData: number; availableInSrcTbl: number }> {
    const fileName = await indexedDB.getFilename(req_id)
    const db = await createDuckDbClient()
    if (!db) {
      logger.error('Failed to create DuckDB client for granule counts', { req_id })
      return { usedInData: 0, availableInSrcTbl: 0 }
    }

    await db.insertOpfsParquet(fileName)

    // First load the srctbl lookup table
    await setSourceTbl(req_id)
    const table = sourceTables.value.get(req_id) || []
    const availableInSrcTbl = new Set(table).size

    // Query distinct srcids from the elevation data
    let usedInData = 0
    try {
      const result = await db.query(`SELECT DISTINCT srcid FROM "${fileName}"`)
      const usedGranuleNames = new Set<string>()
      for await (const rows of result.readRows()) {
        for (const row of rows) {
          const srcid = Number(row.srcid)
          // Look up the granule name and add to set (deduplicates automatically)
          if (srcid >= 0 && srcid < table.length) {
            usedGranuleNames.add(table[srcid])
          }
        }
      }
      usedInData = usedGranuleNames.size
    } catch (error) {
      logger.warn('getGranuleCounts: Could not query srcid from elevation data', {
        req_id,
        fileName,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    return { usedInData, availableInSrcTbl }
  }

  async function getSourceTblForFile(fileName: string): Promise<string[]> {
    await setSrcIdTblWithFileName(fileName)
    return sourceTable.value
  }

  function getSourceTableForReqId(reqId: number): string[] {
    return sourceTables.value.get(reqId) || []
  }

  return {
    sourceTable,
    sourceTables,
    getUniqueSourceCount,
    getTotalSourceCount,
    getSourceCounts,
    getGranuleCounts,
    getSourceTblForFile,
    getSourceTableForReqId
  }
})
