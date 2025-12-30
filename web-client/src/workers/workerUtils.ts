import type { SysConfig } from '@/sliderule/core'
import type { SrRunContext } from '@/db/SlideRuleDb'
import type { ReqParams } from '@/types/SrTypes'
import { db } from '@/db/SlideRuleDb'
import { createLogger } from '@/utils/logger'

const logger = createLogger('WorkerUtils')
// No Pinia store can be used in this file because it is called from a web worker

export interface WebWorkerCmd {
  type: string // 'run', 'abort'
  req_id: number
  sysConfig?: SysConfig
  func?: string
  parameters?: ReqParams
  context?: SrRunContext
}

export type WorkerStatus =
  | 'started'
  | 'progress'
  | 'summary'
  | 'success'
  | 'error'
  | 'geoParquet_rcvd'
  | 'feather_rcvd'
  | 'opfs_ready'
  | 'server_msg'
  | 'aborted'

export interface WorkerError {
  type: string
  code: string
  message: string
  func?: string // The API function that failed (e.g., 'atl03x-surface')
}
export interface SrProgress {
  read_state: string
  target_numSvrExceptions: number
  numSvrExceptions: number
  target_numArrowDataRecs: number
  numArrowDataRecs: number
  target_numArrowMetaRecs: number
  numArrowMetaRecs: number
}
export interface WorkerMessage {
  req_id: number // Request ID
  status: WorkerStatus // Status of the worker
  progress?: SrProgress // Percentage for progress updates
  msg?: string // status details
  error?: WorkerError // Error details (if an error occurred)
  data?: Uint8Array[] // Data returned by the worker
  blob?: Blob // Data returned by the worker
  metadata?: string // Metadata returned by the worker
}
export interface ExtLatLon {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}
export interface ExtHMean {
  minHMean: number
  maxHMean: number
  lowHMean: number // 5th percentile
  highHMean: number // 95th percentile
}

export interface WorkerSummary extends WorkerMessage {
  extLatLon: ExtLatLon
  extHMean: ExtHMean
  numPoints: number
}

export async function startedMsg(req_id: number, req_params: ReqParams): Promise<WorkerMessage> {
  const workerStartedMsg: WorkerMessage = {
    req_id: req_id,
    status: 'started',
    msg: `Starting req_id: ${req_id}`
  }
  try {
    // initialize request record in db
    await db.updateRequestRecord({
      req_id: req_id,
      status: workerStartedMsg.status,
      parameters: req_params as import('@/types/SrTypes').AtlxxReqParams,
      status_details: workerStartedMsg.msg,
      start_time: new Date(),
      end_time: new Date(),
      elapsed_time: ''
    })
  } catch (error) {
    logger.error('Failed to update request status to started', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
  }
  return workerStartedMsg
}

export async function abortedMsg(req_id: number, msg: string): Promise<WorkerMessage> {
  const workerAbortedMsg: WorkerMessage = {
    req_id: req_id,
    status: 'aborted',
    msg: `Aborting req_id: ${req_id}`
  }
  try {
    // initialize request record in db
    await db.updateRequestRecord({ req_id: req_id, status: 'aborted', status_details: msg }, true)
  } catch (error) {
    logger.error('Failed to update request status to aborted', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
  }
  return workerAbortedMsg
}

export function progressMsg(req_id: number, progress: SrProgress, msg: string): WorkerMessage {
  const workerProgressMsg: WorkerMessage = {
    req_id: req_id,
    status: 'progress',
    progress: progress,
    msg: msg
  }
  //console.log(msg)
  //console.log('progressMsg  num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
  return workerProgressMsg
}

export async function serverMsg(req_id: number, msg: string): Promise<WorkerMessage> {
  const workerServerMsg: WorkerMessage = { req_id: req_id, status: 'server_msg', msg: msg }
  try {
    await db.updateRequestRecord({ req_id: req_id, status: 'server_msg', status_details: msg })
  } catch (error) {
    logger.error('Failed to update request status to server_msg', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
  }
  return workerServerMsg
}

export async function errorMsg(
  req_id: number = 0,
  workerError: WorkerError
): Promise<WorkerMessage> {
  const workerErrorMsg: WorkerMessage = { req_id: req_id, status: 'error', error: workerError }
  logger.error('Worker errorMsg:', {
    reqId: req_id,
    errorType: workerError.type,
    errorCode: workerError.code,
    errorMessage: workerError.message
  })
  if (req_id > 0) {
    try {
      await db.updateRequestRecord(
        { req_id: req_id, status: 'error', status_details: workerError.message },
        true
      )
    } catch (error) {
      logger.error('Failed to update request status to error', {
        reqId: req_id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  } else {
    logger.error('req_id was not provided for errorMsg')
  }
  return workerErrorMsg
}

export async function successMsg(req_id: number, msg: string): Promise<WorkerMessage> {
  const workerSuccessMsg: WorkerMessage = { req_id: req_id, status: 'success', msg: msg }
  try {
    await db.updateRequestRecord({ req_id: req_id, status: 'success', status_details: msg }, true)
  } catch (error) {
    logger.error('Failed to update request status to success', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
  }
  return workerSuccessMsg
}

// export async function summaryMsg(workerSummaryMsg:WorkerSummary, msg: string): Promise<WorkerMessage> {
//     try{
//         console.log('summaryMsg workerSummaryMsg:',workerSummaryMsg);
//         await db.updateRequestRecord( {req_id:workerSummaryMsg.req_id, cnt:workerSummaryMsg.numPoints, status: 'summary',status_details: msg});
//         await db.updateSummary(workerSummaryMsg);
//     } catch (error) {
//         console.error('Failed to update request status to summary:', error, ' for req_id:', workerSummaryMsg.req_id);
//     }
//     return workerSummaryMsg;
// }

export function geoParquetMsg(req_id: number, filename: string, blob: Blob): WorkerMessage {
  const workerDataMsg: WorkerMessage = {
    req_id: req_id,
    status: 'geoParquet_rcvd',
    blob: blob,
    metadata: filename
  }
  return workerDataMsg
}

export function featherMsg(req_id: number, filename: string, blob: Blob): WorkerMessage {
  const workerDataMsg: WorkerMessage = {
    req_id: req_id,
    status: 'feather_rcvd',
    blob: blob,
    metadata: filename
  }
  return workerDataMsg
}

export function opfsReadyMsg(req_id: number, filename: string): WorkerMessage {
  const workerDataMsg: WorkerMessage = { req_id: req_id, status: 'opfs_ready', metadata: filename }
  return workerDataMsg
}
