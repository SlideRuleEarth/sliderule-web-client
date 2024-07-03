import type { SysConfig } from "@/sliderule/core"
import { db } from "@/db/SlideRuleDb";
import { type ReqParams } from "@/stores/reqParamsStore";
import { type SrScatterOptionsParms } from "@/utils/parmUtils";
import { createDuckDbClient, type QueryResult } from '@/utils/SrDuckDb';

export interface FtfWebWorkerCmd {
    type: string; // 'run', 'abort' 
    req_id: number;
    sysConfig?: SysConfig;
    func?: string;
    parameters?: ReqParams;
}

export type FtfWorkerStatus = 'started' | 'progress' | 'summary' | 'success' | 'error' | 'geoParquet_rcvd' | 'feather_rcvd' | 'opfs_ready' | 'server_msg' | 'aborted';

export interface FtfWorkerError {
    type: string;
    code: string;
    message: string;
}
export interface ftfProgress {
    read_state: string;
    target_numSvrExceptions: number;
    numSvrExceptions: number;
    target_numArrowDataRecs: number;
    numArrowDataRecs: number;
    target_numArrowMetaRecs: number;
    numArrowMetaRecs: number;
}
export interface FtfWorkerMessage {
    req_id: number;             // Request ID
    status: FtfWorkerStatus;       // Status of the worker
    progress?: ftfProgress;      // Percentage for progress updates
    msg?: string;               // status details
    error?: FtfWorkerError;        // Error details (if an error occurred)
    data?: Uint8Array[];         // Data returned by the worker
    blob?: Blob;                // Data returned by the worker
    metadata?: string;          // Metadata returned by the worker
}
export interface ExtLatLon {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}
export interface ExtHMean {
    minHMean: number;
    maxHMean: number;
    lowHMean: number;   // 5th percentile
    highHMean: number;  // 95th percentile
}

export interface SopWorkerCmdMsg {
    parms: SrScatterOptionsParms;
}

// Define the structure of the message posted by the worker
export interface SopWorkerRspMsg {
    scatterOptions: any;
    error?: string;
}


export interface WorkerSummary extends FtfWorkerMessage {
    extLatLon: ExtLatLon;
    extHMean: ExtHMean;
}

export async function startedMsg(req_id:number,req_params:ReqParams): Promise<FtfWorkerMessage>{
    const workerStartedMsg: FtfWorkerMessage =  { req_id:req_id, status: 'started', msg:`Starting req_id: ${req_id}`};
    try{
        // initialize request record in db
        await db.updateRequestRecord( {req_id:req_id,status:workerStartedMsg.status, parameters:req_params,status_details: workerStartedMsg.msg, start_time: new Date(), end_time: new Date(), elapsed_time: ''});
    } catch (error) {
        console.error('Failed to update request status to started:', error, ' for req_id:', req_id);
    }
    return workerStartedMsg;
}

export async function abortedMsg(req_id:number, msg: string): Promise<FtfWorkerMessage> {
    const workerAbortedMsg: FtfWorkerMessage =  { req_id:req_id, status: 'aborted', msg:`Aborting req_id: ${req_id}`};
    try{
        // initialize request record in db
        await db.updateRequestRecord( {req_id:req_id, status: 'aborted',status_details: msg});
    } catch (error) {
        console.error('Failed to update request status to aborted:', error, ' for req_id:', req_id);
    }
    return workerAbortedMsg;
}

export async function progressMsg(  req_id:number, 
                                    progress:ftfProgress, 
                                    msg: string): Promise<FtfWorkerMessage> {
    const workerProgressMsg: FtfWorkerMessage =  { req_id:req_id, status: 'progress', progress:progress, msg:msg };
    //console.log(msg)
    //console.log('progressMsg  num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
    return workerProgressMsg;
}

export async function serverMsg(req_id:number,  msg: string): Promise<FtfWorkerMessage> {
    const workerServerMsg: FtfWorkerMessage =  { req_id:req_id, status: 'server_msg', msg:msg };
    try{
        await db.updateRequestRecord( {req_id:req_id, status: 'server_msg',status_details: msg});
    } catch (error) {
        console.error('Failed to update request status to server_msg:', error, ' for req_id:', req_id);
    }
    return workerServerMsg;
}

export async function errorMsg(req_id:number=0, workerError: FtfWorkerError): Promise<FtfWorkerMessage> {
    const workerErrorMsg: FtfWorkerMessage = { req_id:req_id, status: 'error', error: workerError };
    if(req_id > 0) {
        try{
            await db.updateRequestRecord( {req_id:req_id, status: 'error',status_details: workerError.message});
        } catch (error) {
            console.error('Failed to update request status to error:', error, ' for req_id:', req_id);
        }
    } else {
        console.error('req_id was not provided for errorMsg');
    }
    return workerErrorMsg;
}

export async function successMsg(req_id:number, msg:string): Promise<FtfWorkerMessage> {
    const workerSuccessMsg: FtfWorkerMessage = { req_id:req_id, status: 'success', msg:msg };
    try{
        await db.updateRequestRecord( {req_id:req_id, status: 'success',status_details: msg});
    } catch (error) {
        console.error('Failed to update request status to success:', error, ' for req_id:', req_id);
    }
    return workerSuccessMsg;
}

export async function summaryMsg(workerSummaryMsg:WorkerSummary, msg: string): Promise<FtfWorkerMessage> {
    try{
        await db.updateRequestRecord( {req_id:workerSummaryMsg.req_id, status: 'summary',status_details: msg});
        await db.updateSummary(workerSummaryMsg);
    } catch (error) {
        console.error('Failed to update request status to summary:', error, ' for req_id:', workerSummaryMsg.req_id);
    }
    return workerSummaryMsg;
}

export function geoParquetMsg(req_id:number,filename:string, blob:Blob): FtfWorkerMessage{
    const workerDataMsg: FtfWorkerMessage = { req_id:req_id, status: 'geoParquet_rcvd', blob: blob, metadata: filename};
    return workerDataMsg;
}

export function featherMsg(req_id:number,filename:string, blob:Blob): FtfWorkerMessage{
    const workerDataMsg: FtfWorkerMessage = { req_id:req_id, status: 'feather_rcvd', blob: blob, metadata: filename};
    return workerDataMsg;
}

export function opfsReadyMsg(req_id:number,filename:string): FtfWorkerMessage{
    const workerDataMsg: FtfWorkerMessage = { req_id:req_id, status: 'opfs_ready',  metadata: filename};
    return workerDataMsg;
}

export interface SrScatterChartData { value: number[] };

async function fetchAtl03ScatterData(fileName: string, x: string, y: string[],scOrient:number,pair:number, rgt: number, cycle: number, tracks:number[]) {
    const duckDbClient = await createDuckDbClient();
    const chartData: { [key: string]: SrScatterChartData[] } = {};
    const minMaxValues: { [key: string]: { min: number, max: number } } = {};

    try {
        const yColumns = y.join(", ");
        const query = `
            SELECT 
                ${x}, 
                ${yColumns}
            FROM '${fileName}'
            WHERE pair = ${pair} AND sc_orient = ${scOrient} AND rgt = ${rgt} AND cycle = ${cycle}
        `;
        const queryResult: QueryResult = await duckDbClient.query(query);

        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    y.forEach((yName) => {
                        if (!chartData[yName]) {
                            chartData[yName] = [];
                        }
                        chartData[yName].push({
                            value: [row[x], row[yName]]
                        });
                    });
                } else {
                    console.warn('fetchAtl03ScatterData - fetchData rowData is null');
                }
            }
        }

        const query2 = `
            SELECT 
                MIN(${x}) as min_x,
                MAX(${x}) as max_x,
                ${y.map(yName => `MIN(${yName}) as min_${yName}, MAX(${yName}) as max_${yName}`).join(", ")}
            FROM '${fileName}'
            WHERE track IN (${tracks.join(", ")}) 
            AND pair = ${pair} 
            AND sc_orient = ${scOrient} 
            AND rgt = ${rgt} 
            AND cycle = ${cycle}
        `;
        //console.log('fetchAtl03ScatterData query2:', query2);
        const queryResult2: QueryResult = await duckDbClient.query(query2);
        //console.log('fetchAtl03ScatterData queryResult2:', queryResult2);
        for await (const rowChunk of queryResult2.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    //useAtlChartFilterStore().setMinX(row.min_x);
                    //useAtlChartFilterStore().setMaxX(row.max_x);
                    minMaxValues['x'] = { min: row.min_x, max: row.max_x };
                    y.forEach((yName) => {
                        minMaxValues[yName] = { min: row[`min_${yName}`], max: row[`max_${yName}`] };
                    });
                } else {
                    console.warn('fetchAtl03ScatterData fetchData rowData is null');
                }
            }
        }
        //console.log('fetchAtl03ScatterData minMaxValues:', minMaxValues);
        return { chartData, minMaxValues };
    } catch (error) {
        console.error('fetchAtl03ScatterData fetchData Error fetching data:', error);
        return { chartData: {}, minMaxValues: {} };
    }
}

async function fetchAtl06ScatterData(fileName: string, x: string, y: string[], beams: number[], rgt: number, cycle: number) {
    console.log('fetchAtl06ScatterData fileName:', fileName, ' x:', x, ' y:', y, ' beams:', beams, ' rgt:', rgt, ' cycle:', cycle);
    const duckDbClient = await createDuckDbClient();
    const chartData: { [key: string]: SrScatterChartData[] } = {};
    const minMaxValues: { [key: string]: { min: number, max: number } } = {};
    try {
        const yColumns = y.join(", ");
        const query = `
            SELECT 
                ${x}, 
                ${yColumns}
            FROM '${fileName}'
            WHERE gt = ${beams[0]} AND rgt = ${rgt} AND cycle = ${cycle}
        `;
        const queryResult: QueryResult = await duckDbClient.query(query);

        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    y.forEach((yName) => {
                        if (!chartData[yName]) {
                            chartData[yName] = [];
                        }
                        chartData[yName].push({
                            value: [row[x], row[yName]]
                        });
                    });
                } else {
                    console.warn('fetchData rowData is null');
                }
            }
        }

        const query2 = `
            SELECT 
                MIN(${x}) as min_x,
                MAX(${x}) as max_x,
                ${y.map(yName => `MIN(${yName}) as min_${yName}, MAX(${yName}) as max_${yName}`).join(", ")}
            FROM '${fileName}'
            WHERE gt = ${beams[0]} AND rgt = ${rgt} AND cycle = ${cycle}
        `;
        console.log('fetchAtl06ScatterData query2:', query2);
        const queryResult2: QueryResult = await duckDbClient.query(query2);
        console.log('fetchAtl06ScatterData queryResult2:', queryResult2);
        for await (const rowChunk of queryResult2.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    //useAtlChartFilterStore().setMinX(row.min_x);
                    //useAtlChartFilterStore().setMaxX(row.max_x);
                    minMaxValues['x'] = { min: row.min_x, max: row.max_x };
                    y.forEach((yName) => {
                        minMaxValues[yName] = { min: row[`min_${yName}`], max: row[`max_${yName}`] };
                    });
                } else {
                    console.warn('fetchData rowData is null');
                }
            }
        }
        console.log('fetchAtl06ScatterData minMaxValues:', minMaxValues);
        return { chartData, minMaxValues };
    } catch (error) {
        console.error('fetchData Error fetching data:', error);
        return { chartData: {}, minMaxValues: {} };
    }
}
interface SrScatterSeriesData {
    name: string;
    type: string;
    data: number[][];
    yAxisIndex: number;
}

interface MinMaxValues {
    [key: string]: { min: number, max: number };
}

interface SeriesWithMinMax {
    series: SrScatterSeriesData;
    min: number;
    max: number;
}

interface SeriesDataResult {
    seriesData: SeriesWithMinMax[];
    minMaxValues: MinMaxValues;
}

async function getSeriesForAtl03(
    fileName: string, 
    x: string, 
    y: string[], 
    scOrient: number,
    pair: number, 
    rgt: number, 
    cycle: number, 
    tracks: number[]
): Promise<SeriesDataResult> {
    console.log('getSeriesForAtl03 fileName:', fileName, ' x:', x, ' y:', y, ' scOrient:', scOrient, ' pair:', pair, ' rgt:', rgt, ' cycle:', cycle);
    const name = 'Atl03';
    const { chartData, minMaxValues } = await fetchAtl03ScatterData(fileName, x, y, scOrient, pair, rgt, cycle, tracks);
    if (chartData) {
        const seriesData: SeriesWithMinMax[] = y.map(yName => ({
            series: {
                name: `${name} - ${yName}`,
                type: 'scatter',
                data: chartData[yName] ? chartData[yName].map(item => item.value) : [],
                yAxisIndex: y.indexOf(yName) // Set yAxisIndex to map each series to its respective yAxis
            },
            min: minMaxValues[yName].min,
            max: minMaxValues[yName].max
        }));
        return { seriesData, minMaxValues };
    }
    return { seriesData: [], minMaxValues: {} };
}

async function getSeriesForAtl06(
    fileName: string, 
    x: string, 
    y: string[], 
    beams: number[], 
    rgt: number, 
    cycle: number
): Promise<SeriesDataResult> {
    console.log('getSeriesForAtl06 fileName:', fileName, ' x:', x, ' y:', y, ' beams:', beams, ' rgt:', rgt, ' cycle:', cycle);
    const name = 'Atl06';
    const { chartData, minMaxValues } = await fetchAtl06ScatterData(fileName, x, y, beams, rgt, cycle);
    if (chartData) {
        const seriesData: SeriesWithMinMax[] = y.map(yName => ({
            series: {
                name: `${name} - ${yName}`,
                type: 'scatter',
                data: chartData[yName] ? chartData[yName].map(item => item.value) : [],
                yAxisIndex: y.indexOf(yName) // Set yAxisIndex to map each series to its respective yAxis
            },
            min: minMaxValues[yName].min,
            max: minMaxValues[yName].max
        }));
        return { seriesData, minMaxValues };
    }
    return { seriesData: [], minMaxValues: {} };
}

export async function getScatterOptions(sop:SrScatterOptionsParms): Promise<any> {
    const startTime = performance.now(); // Start time
    console.log('getScatterOptions sop:', sop);
    const duckDbClient = await createDuckDbClient();
            
    try {
        await duckDbClient.insertOpfsParquet(sop.fileName);
    } catch (error) {
        console.error('getScatterOptions error:', error);
        throw error;
    }


    let options = null;
    let seriesResult = {} as SeriesDataResult;
    if(sop.fileName){
        if(sop.func === 'atl06'){
            if(sop.beams?.length && sop.rgt && sop.cycle){
                console.log('getScatterOptions atl06 fileName:', sop.fileName, ' x:', sop.x, ' y:', sop.y, ' beams:', sop.beams, ' rgt:', sop.rgt, ' cycle:', sop.cycle);
                seriesResult = await getSeriesForAtl06(sop.fileName, sop.x, sop.y, sop.beams, sop.rgt, sop.cycle);
            } else {
                console.warn('getScatterOptions atl06 invalid? beams:', sop.beams, ' rgt:', sop.rgt, ' cycle:', sop.cycle);
            }
        } else if(sop.func === 'atl03'){
            if((sop.pair) && (sop.scOrient) && (sop.rgt) && (sop.cycle) && (sop.tracks) && sop.tracks.length){
                //console.log('getScatterOptions atl03 fileName:', sop.fileName, ' x:', sop.x, ' y:', sop.y, 'scOrient:',sop.scOrient, 'pair:',sop.pair, ' rgt:', sop.rgt, ' cycle:', sop.cycle, 'tracks:', sop.tracks);
                seriesResult = await getSeriesForAtl03(sop.fileName, sop.x, sop.y, sop.scOrient, sop.pair, sop.rgt, sop.cycle, sop.tracks);
            } else {
                console.error('atl03 getScatterOptions INVALID? fileName:', sop.fileName, ' x:', sop.x, ' y:', sop.y, 'scOrient:',sop.scOrient, 'pair:',sop.pair, ' rgt:', sop.rgt, ' cycle:', sop.cycle, 'tracks:', sop.tracks);
            }
        } else {
            console.error('getScatterOptions invalid func:', sop.func);
        }
    } else {
        console.warn('getScatterOptions fileName is null');
    }
    options = {
        title: {
            text: sop.func,
            left: "center"
        },
        tooltip: {
            trigger: "item",
            formatter: "({c})"
        },
        legend: {
            data: seriesResult.seriesData.map(series => series.series.name),
            left: 'left'
        },
        xAxis: {
            min: seriesResult.minMaxValues['x'].min, //useAtlChartFilterStore().getMinX(),
            max: seriesResult.minMaxValues['x'].max //useAtlChartFilterStore().getMaxX()
        },
        yAxis: seriesResult.seriesData.map((series, index) => ({
            type: 'value',
            name: sop.y[index],
            min: seriesResult.seriesData[index].min,
            max: seriesResult.seriesData[index].max,
            scale: true,  // Add this to ensure the axis scales correctly
            axisLabel: {
                formatter: (value: number) => value.toFixed(1)  // Format to one decimal place
            }
        })),
        series: seriesResult.seriesData.map(series => series.series)
    };
    //console.log('getScatterOptions options:', options);
    const endTime = performance.now(); // End time
    console.log(`getScatterOptions took ${endTime - startTime} milliseconds.`);
  return options;
}

