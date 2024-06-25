import { ref } from 'vue';
import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { createDuckDbClient, type QueryResult, type Row } from './SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { updateElLayerWithObject,type ElevationDataItem } from './SrMapUtils';
import { getHeightFieldname } from "./SrParquetUtils";
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { useAtl06ChartFilterStore } from '@/stores/atl06ChartFilterStore';

const atl06ChartFilterStore = useAtl06ChartFilterStore();

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
            await duckDbClient.insertOpfsParquet(filename);
            try {
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
    try{
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

            // Execute the query
            const results = await duckDbClient.query(`SELECT * FROM '${filename}'`);
            //console.log('duckDbReadAndUpdateElevationData results:', results);

            // Read all rows from the QueryResult
            const rows: ElevationDataItem[] = [];
            for await (const row of results.readRows()) {
                rows.push(row);
            }
            //console.log('duckDbReadAndUpdateElevationData rows:',rows, 'rows[0][0]',rows[0][0],'rows[0]',rows[0],'rows[0].length:',rows[0].length,'rows.length:',rows.length);
            const fieldNames = Object.keys(rows[0][0]);

            //console.log('duckDbReadAndUpdateElevationData fieldNames:',fieldNames);
            // Process and update the elevation data as needed
            if (rows.length > 0) {

                // Process and update the elevation data as needed
                // Extract field names from the first row (assuming all rows have the same structure)

                // Find the indexes for hMean, latitude, and longitude
                const hMeanNdx = fieldNames.indexOf(height_fieldname);
                const lonNdx = fieldNames.indexOf('longitude');
                const latNdx = fieldNames.indexOf('latitude');

                //console.log('duckDbReadAndUpdateElevationData  hMeanNdx:', hMeanNdx, ' lonNdx:', lonNdx, ' latNdx:', latNdx, ' summary.extHMean:', summary.extHMean);
                //console.log('duckDbReadAndUpdateElevationData rows:',rows,' fieldNames:', fieldNames);
                updateElLayerWithObject(rows[0] as ElevationDataItem[], summary.extHMean, height_fieldname);//TBD rows[0] is really rowsChunk[0] iter thru both!
            } else {
                console.warn('duckDbReadAndUpdateElevationData rows is empty');
            }

        } else {
            console.error('duckDbReadAndUpdateElevationData summary is undefined');
        }
    } catch (error) {
        console.error('duckDbReadAndUpdateElevationData error:',error);
        throw error;
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

async function fetchScatterData(fileName: string, x: string, y: string[], beams: number[], rgt: number, cycle: number) {
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
            WHERE gt = ${beams[0]} AND rgt = ${rgt}
        `;
        console.log('fetchScatterData query2:', query2);
        const queryResult2: QueryResult = await duckDbClient.query(query2);
        console.log('fetchScatterData queryResult2:', queryResult2);
        for await (const rowChunk of queryResult2.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    atl06ChartFilterStore.setMinX(row.min_x);
                    atl06ChartFilterStore.setMaxX(row.max_x);
                    y.forEach((yName) => {
                        minMaxValues[yName] = { min: row[`min_${yName}`], max: row[`max_${yName}`] };
                    });
                } else {
                    console.warn('fetchData rowData is null');
                }
            }
        }
        console.log('fetchScatterData minMaxValues:', minMaxValues);
        return { chartData, minMaxValues };
    } catch (error) {
        console.error('fetchData Error fetching data:', error);
        return { chartData: {}, minMaxValues: {} };
    }
}

async function getSeries(name: string, fileName: string, x: string, y: string[], beams: number[], rgt: number, cycle: number) {
    const { chartData, minMaxValues } = await fetchScatterData(fileName, x, y, beams, rgt, cycle);
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

export async function getScatterOptions(title: string,y:string[]): Promise<any> {
    console.log('getScatterOptions title:', title, ' y:', y);
    const beams = atl06ChartFilterStore.getBeams();
    const rgt = atl06ChartFilterStore.getRgt();
    const cycle = atl06ChartFilterStore.getCycle();
    const x = 'x_atc';
    const fileName = atl06ChartFilterStore.getFileName();
    let options = null;
    console.log('getScatterOptions fileName:', fileName, ' x:', x, ' y:', y, ' beams:', beams, ' rgt:', rgt, ' cycle:', cycle);
    if(fileName){
        if (beams.length && rgt && cycle) {
            const seriesData = await getSeries('Atl06', fileName, x, y, beams, rgt, cycle);
            options = {
                title: {
                    text: title,
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
                    min: atl06ChartFilterStore.getMinX(),
                    max: atl06ChartFilterStore.getMaxX()
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
        } else {
            console.warn('getScatterOptions beams:', beams, ' rgt:', rgt, ' cycle:', cycle);
        }
    } else {
        console.warn('getScatterOptions fileName is null');
    }
    console.log('getScatterOptions options:', options);
    return options;
}
