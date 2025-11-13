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
    getSourceTblForFile,
    getSourceTableForReqId
  }
})
