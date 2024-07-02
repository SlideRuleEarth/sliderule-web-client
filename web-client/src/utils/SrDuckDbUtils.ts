import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { createDuckDbClient, type QueryResult } from './SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { updateElLayerWithObject,type ElevationDataItem } from './SrMapUtils';
import { getHeightFieldname } from "./SrParquetUtils";
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { removeCurrentDeckLayer } from './SrMapUtils';

interface SummaryRowData {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
    minHMean: number;
    maxHMean: number;
    lowHMean: number;
    highHMean: number;
}

export async function duckDbReadOrCacheSummary(req_id: number, height_fieldname: string): Promise<SrRequestSummary | undefined> {
    try {

        const filename = await indexedDb.getFilename(req_id);
        const summary = await indexedDb.getWorkerSummary(req_id);
        console.log('duckDbReadOrCacheSummary req_id:', req_id, ' summary:', summary);
        
        if (summary) {
            return summary;
        } else {
            const localExtLatLon: ExtLatLon = { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 };
            const localExtHMean: ExtHMean = { minHMean: 100000, maxHMean: -100000, lowHMean: 100000, highHMean: -100000 };
            const duckDbClient = await createDuckDbClient();
            
            try {
                await duckDbClient.insertOpfsParquet(filename);
                console.log('duckDbReadOrCacheSummary height_fieldname:', height_fieldname);

                const results = await duckDbClient.query(`
                    SELECT
                        MIN(latitude) as minLat,
                        MAX(latitude) as maxLat,
                        MIN(longitude) as minLon,
                        MAX(longitude) as maxLon,
                        MIN(${duckDbClient.escape(height_fieldname)}) as minHMean,
                        MAX(${duckDbClient.escape(height_fieldname)}) as maxHMean,
                        PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY ${duckDbClient.escape(height_fieldname)}) AS perc10HMean,
                        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ${duckDbClient.escape(height_fieldname)}) AS perc90HMean
                    FROM
                        '${filename}'
                `);
                
                // Collect rows from the async generator
                const rows: SummaryRowData[] = [];
                for await (const row of results.readRows()) {
                    const rowData = row[0]; // Assuming readRows returns an array of rows
                    const typedRow: SummaryRowData = {
                        minLat: rowData.minLat,
                        maxLat: rowData.maxLat,
                        minLon: rowData.minLon,
                        maxLon: rowData.maxLon,
                        minHMean: rowData.minHMean,
                        maxHMean: rowData.maxHMean,
                        lowHMean: rowData.perc10HMean,
                        highHMean: rowData.perc90HMean
                    };
                    //console.log('duckDbReadOrCacheSummary typedRow:', typedRow);
                    rows.push(typedRow);
                    //console.log('duckDbReadOrCacheSummary rows:', rows);
                }
                if (rows.length > 0) {
                    const row = rows[0];
                    //console.log('duckDbReadOrCacheSummary row:', row);
                    localExtLatLon.minLat = row.minLat;
                    localExtLatLon.maxLat = row.maxLat;
                    localExtLatLon.minLon = row.minLon;
                    localExtLatLon.maxLon = row.maxLon;
                    localExtHMean.minHMean = row.minHMean;
                    localExtHMean.maxHMean = row.maxHMean;
                    localExtHMean.lowHMean = row.lowHMean;
                    localExtHMean.highHMean = row.highHMean;
                    //console.log('duckDbReadOrCacheSummary localExtLatLon:', localExtLatLon, ' localExtHMean:', localExtHMean);
                    await indexedDb.addNewSummary({ req_id: req_id, extLatLon: localExtLatLon, extHMean: localExtHMean });
                } else {
                    throw new Error('No rows returned');
                }
                return await indexedDb.getWorkerSummary(req_id);
            } catch (error) {
                console.error('duckDbReadOrCacheSummary error:', error);
                throw error;
            }
        }
    } catch (error) {
        console.error('duckDbReadOrCacheSummary error:', error);
        throw error;
    }
}

export const duckDbReadAndUpdateElevationData = async (req_id:number) => {
    console.log('duckDbReadAndUpdateElevationData req_id:',req_id);
    const startTime = performance.now(); // Start time
    try{
        if(await indexedDb.getStatus(req_id) === 'error'){
            console.log('duckDbReadAndUpdateElevationData req_id:',req_id,' status is error SKIPPING!');
            removeCurrentDeckLayer();
            return;
        }
        const height_fieldname = await getHeightFieldname(req_id);
        //console.log('duckDbReadAndUpdateElevationData req_id:',req_id);
        const summary = await duckDbReadOrCacheSummary(req_id,height_fieldname);
        //console.log('duckDbReadAndUpdateElevationData summary:',summary);
        if(summary){
            //console.log('duckDbReadAndUpdateElevationData summary:',summary);
            useCurReqSumStore().setSummary(summary);

            // Step 1: Initialize the DuckDB client
            const duckDbClient = await createDuckDbClient();

            // Step 2: Retrieve the filename using req_id
            const filename = await indexedDb.getFilename(req_id);
            
            // Step 3: Register the Parquet file with DuckDB
            await duckDbClient.insertOpfsParquet(filename);
            // Step 4: Execute a SQL query to retrieve the elevation data
            console.log(`duckDbReadAndUpdateElevationData for req:${req_id} PRE  Query took ${performance.now() - startTime} milliseconds.`);

            // Execute the query
            const results = await duckDbClient.query(`SELECT * FROM '${filename}'`);
            //console.log('duckDbReadAndUpdateElevationData results:', results);
            console.log(`duckDbReadAndUpdateElevationData for ${req_id} POST Query took ${performance.now() - startTime} milliseconds.`);

            // Read all rowChunks from the QueryResult
            const rowChunks: ElevationDataItem[] = [];
            for await (const rowChunk of results.readRows()) {
                rowChunks.push(rowChunk);
            }
            //console.log('duckDbReadAndUpdateElevationData rowChunks:',rowChunks, 'rowChunks[0][0]',rowChunks[0][0],'rowChunks[0]',rowChunks[0],'rowChunks[0].length:',rowChunks[0].length,'rowChunks.length:',rowChunks.length);
            const fieldNames = Object.keys(rowChunks[0][0]);
            console.log('duckDbReadAndUpdateElevationData fieldNames:',fieldNames);
            console.log('duckDbReadAndUpdateElevationData rowChunks.length :',rowChunks.length);
            await useAtlChartFilterStore().setElevationDataOptionsFromFieldNames(fieldNames);
            // Process and update the elevation data as needed
            // Assuming rowChunks is an array of ElevationDataItem[] arrays
            if (rowChunks.length > 0) {
                for (const chunk of rowChunks) {
                    updateElLayerWithObject(chunk as ElevationDataItem[], summary.extHMean, height_fieldname);
                }
            } else {
                console.warn('duckDbReadAndUpdateElevationData rowChunks is empty');
            }

        } else {
            console.error('duckDbReadAndUpdateElevationData summary is undefined');
        }
    } catch (error) {
        console.error('duckDbReadAndUpdateElevationData error:',error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`duckDbReadAndUpdateElevationData for ${req_id} took ${endTime - startTime} milliseconds.`);
    }
}

export async function duckDbLoadOpfsParquetFile(fileName: string) {
    try{
        console.log('duckDbLoadOpfsParquetFile');
        const duckDbClient = await createDuckDbClient();

        await duckDbClient.insertOpfsParquet(fileName);

    } catch (error) {
        console.error('duckDbLoadOpfsParquetFile error:',error);
        throw error;
    }
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
        console.log('fetchAtl03ScatterData query2:', query2);
        const queryResult2: QueryResult = await duckDbClient.query(query2);
        console.log('fetchAtl03ScatterData queryResult2:', queryResult2);
        for await (const rowChunk of queryResult2.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    useAtlChartFilterStore().setMinX(row.min_x);
                    useAtlChartFilterStore().setMaxX(row.max_x);
                    y.forEach((yName) => {
                        minMaxValues[yName] = { min: row[`min_${yName}`], max: row[`max_${yName}`] };
                    });
                } else {
                    console.warn('fetchAtl03ScatterData fetchData rowData is null');
                }
            }
        }
        console.log('fetchAtl03ScatterData minMaxValues:', minMaxValues);
        return { chartData, minMaxValues };
    } catch (error) {
        console.error('fetchAtl03ScatterData fetchData Error fetching data:', error);
        return { chartData: {}, minMaxValues: {} };
    }
}


async function fetchAtl06ScatterData(fileName: string, x: string, y: string[], beams: number[], rgt: number, cycle: number) {
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
                    useAtlChartFilterStore().setMinX(row.min_x);
                    useAtlChartFilterStore().setMaxX(row.max_x);
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
interface SrScatterSeriesData{
    series: {
        name: string;
        type: string;
        data: number[][];
        yAxisIndex: number;
    };
    min: number;
    max: number;
};

async function getSeriesForAtl03( fileName: string, x: string, y: string[], scOrient: number,pair: number, rgt: number, cycle: number, tracks:number[]): Promise<SrScatterSeriesData[]>{
    console.log('getSeriesForAtl03 fileName:', fileName, ' x:', x, ' y:', y, ' scOrient:', scOrient, ' pair:',pair, ' rgt:', rgt, ' cycle:', cycle);
    const name = 'Atl03';
    const { chartData, minMaxValues } = await fetchAtl03ScatterData(fileName, x, y, scOrient, pair, rgt, cycle, tracks);
    if (chartData) {
        return y.map(yName => ({
            name: `${name} - ${yName}`,
            type: 'scatter',
            data: chartData[yName] ? chartData[yName].map(item => item.value) : [],
            yAxisIndex: y.indexOf(yName) // Set yAxisIndex to map each series to its respective yAxis
        })).map((series, index) => ({
            series,
            min: minMaxValues[y[index]].min,
            max: minMaxValues[y[index]].max
        }));
    }
    return [];
}

async function getSeriesForAtl06( fileName: string, x: string, y: string[], beams: number[], rgt: number, cycle: number): Promise<SrScatterSeriesData[]> {
    console.log('getSeriesForAtl06 fileName:', fileName, ' x:', x, ' y:', y, ' beams:', beams, ' rgt:', rgt, ' cycle:', cycle);
    const name = 'Atl06';
    const { chartData, minMaxValues } = await fetchAtl06ScatterData(fileName, x, y, beams, rgt, cycle);
    if (chartData) {
        return y.map(yName => ({
            name: `${name} - ${yName}`,
            type: 'scatter',
            data: chartData[yName] ? chartData[yName].map(item => item.value) : [],
            yAxisIndex: y.indexOf(yName) // Set yAxisIndex to map each series to its respective yAxis
        })).map((series, index) => ({
            series,
            min: minMaxValues[y[index]].min,
            max: minMaxValues[y[index]].max
        }));
    }
    return [];
}

export async function getScatterOptions(): Promise<any> {
    console.log('getScatterOptions');
    const rgt = useAtlChartFilterStore().getRgt();
    const cycle = useAtlChartFilterStore().getCycle();
    const fileName = useAtlChartFilterStore().getFileName();
    const func = useAtlChartFilterStore().getFunc();    
    const y = useAtlChartFilterStore().getYDataForChart();    
    const x = 'x_atc';
    let options = null;
    let seriesData = [] as SrScatterSeriesData[];
    if(fileName){
        if(func === 'atl06'){
            const beams = useAtlChartFilterStore().getBeams();
            console.log('getScatterOptions atl06 fileName:', fileName, ' x:', x, ' y:', y, ' beams:', beams, ' rgt:', rgt, ' cycle:', cycle);
            if (beams.length && rgt && cycle) {
                seriesData = await getSeriesForAtl06(fileName, x, y, beams, rgt, cycle);
            } else {
                console.warn('getScatterOptions atl06 invalid? beams:', beams, ' rgt:', rgt, ' cycle:', cycle);
            }
    } else if(func === 'atl03'){
            const pair = useAtlChartFilterStore().getPair();
            const scOrient = useAtlChartFilterStore().getScOrient();
            const tracks = useAtlChartFilterStore().getTracks();
            if(pair >= 0 && scOrient >= 0){
                console.log('getScatterOptions atl03 fileName:', fileName, ' x:', x, ' y:', y, 'scOrient:',scOrient, 'pair:',pair, ' rgt:', rgt, ' cycle:', cycle);
                seriesData = await getSeriesForAtl03(fileName, x, y, scOrient, pair, rgt, cycle, tracks);
            } else {
                console.warn('getScatterOptions atl03 invalid? pair:', pair, ' scOrient:', scOrient);
            }
        }
    } else {
        console.warn('getScatterOptions fileName is null');
    }
    options = {
        title: {
            text: func,
            left: "center"
        },
        tooltip: {
            trigger: "item",
            formatter: "({c})"
        },
        legend: {
            data: seriesData.map(series => series.series.name),
            left: 'left'
        },
        xAxis: {
            min: useAtlChartFilterStore().getMinX(),
            max: useAtlChartFilterStore().getMaxX()
        },
        yAxis: seriesData.map((series, index) => ({
            type: 'value',
            name: y[index],
            min: seriesData[index].min,
            max: seriesData[index].max,
            scale: true,  // Add this to ensure the axis scales correctly
            axisLabel: {
                formatter: (value: number) => value.toFixed(1)  // Format to one decimal place
            }
        })),
        series: seriesData.map(series => series.series)
    };
    console.log('getScatterOptions options:', options);
    return options;
}
