import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { createDuckDbClient, type QueryResult } from '@/utils//SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { updateDeckLayerWithObject,type ElevationDataItem } from '@/utils/SrMapUtils';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { SrMutex } from '@/utils/SrMutex';
import { useSrToastStore } from "@/stores/srToastStore";
import { srViews } from '@/composables/SrViews';
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { useChartStore} from '@/stores/chartStore';
import type { MinMaxLowHigh, SrListNumberItem } from '@/types/SrTypes';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { isClickable } from '@/utils/SrMapUtils'
import { createWhereClause } from '@/utils/spotUtils';
import { type SrPosition} from '@/types/SrTypes';
import { useAnalysisMapStore } from '@/stores/analysisMapStore';
import { useFieldNameStore } from '@/stores/fieldNameStore';
import { baseType, alias, FLOAT_TYPES, INT_TYPES, DECIMAL_TYPES, BOOL_TYPES, TEMPORAL_TYPES, buildSafeAggregateClauses, getGeometryInfo, getGeometryInfoWithTypes } from '@/utils/duckAgg';
import { extractCrsFromGeoMetadata, transformCoordinate, needsTransformation } from '@/utils/SrCrsTransform';


interface SummaryRowData {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
    minHMean: number;
    maxHMean: number;
    lowHMean: number;
    highHMean: number;
    numPoints: number;
}
const srMutex = new SrMutex();
function aliasKey(prefix: string, colName: string): string {
    return alias(prefix, colName);
}
export const readOrCacheSummary = async (req_id:number) : Promise<SrRequestSummary | undefined> => {
    try{
        const summary = await _duckDbReadOrCacheSummary(req_id);
        //console.log('readOrCacheSummary req_id:', req_id,'hfn:',height_fieldname, ' summary.extHMean:', summary?.extHMean);
        return summary;
    } catch (error) {
        console.error('readOrCacheSummary error:',error);
        throw error;
    }
}

function setElevationDataOptionsFromFieldNames(reqIdStr: string, fieldNames: string[]): void {
    //console.log(`setElevationDataOptionsFromFieldNames reqId:${reqIdStr}`, fieldNames );
    const startTime = performance.now(); // Start time
    const chartStore = useChartStore();
    try {
        const fncs = useFieldNameStore();
        // Update elevation data options in the chart store
        chartStore.setElevationDataOptions(reqIdStr, fieldNames);
        const reqId = parseInt(reqIdStr);
        // Get the height field name
        let heightFieldname = fncs.getHFieldName(reqId);

        // Validate that the height field actually exists in the file
        // If not, the metadata is incorrect and we should use the hardcoded default
        if (!fieldNames.includes(heightFieldname)) {
            console.warn(`Height field "${heightFieldname}" from metadata not found in file columns. Falling back to hardcoded default.`);
            // Clear the cached metadata value so it doesn't get used again
            if (reqId in fncs.recordInfoCache) {
                delete fncs.recordInfoCache[reqId];
            }
            // Get the hardcoded value by calling getHFieldName again (will now skip the cache)
            heightFieldname = fncs.getHFieldName(reqId);
            console.log(`Using hardcoded height field: "${heightFieldname}"`);
        }

        // Find the index of the height field name
        const ndx = fieldNames.indexOf(heightFieldname);
        // Update the index of the elevation data options for height
        chartStore.setNdxOfElevationDataOptionsForHeight(reqIdStr, ndx);
        // Retrieve the existing Y data for the chart
        const defElOptions = fncs.getDefaultElOptions(reqId);
        for(const elevationOption of defElOptions){
            const existingYdata = chartStore.getYDataOptions(reqIdStr);
            // Check if the elevation option is already in the Y data
            if (!existingYdata.includes(elevationOption)) {
                // Clone the existing Y data and add the new elevation option
                const newYdata = [...existingYdata, elevationOption];
                // Update the Y data for the chart
                chartStore.setYDataOptions(reqIdStr, newYdata);
            }
        }
        chartStore.setSelectedYData(reqIdStr,heightFieldname);
        //console.log('setElevationDataOptionsFromFieldNames', { reqIdStr, fieldNames, heightFieldname, ndx } );
    } catch (error) {
        console.error('Error in setElevationDataOptionsFromFieldNames:', error);
    } finally {
        const endTime = performance.now(); // End time
        //console.log(`setElevationDataOptionsFromFieldNames using reqId:${reqIdStr} fieldNames:${fieldNames} selectedYData:${chartStore.getSelectedYData(reqIdStr)} took ${endTime - startTime} milliseconds.`);
    }
}

async function _duckDbReadOrCacheSummary(req_id: number): Promise<SrRequestSummary | undefined> {
    const startTime = performance.now();
    let summary: SrRequestSummary | undefined = undefined;
    const unlock = await srMutex.lock();

    try {
        summary = await indexedDb.getWorkerSummary(req_id);
        if (summary?.extLatLon && summary?.extHMean) {
            return summary;
        }

        const localExtLatLon: ExtLatLon = { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 };
        const localExtHMean: ExtHMean = { minHMean: 1e6, maxHMean: -1e6, lowHMean: 1e6, highHMean: -1e6 };

        // Get all geometry and type info in one call
        const { geometryInfo, colTypes, getType, fileName, duckDbClient } = await getGeometryInfoWithTypes(req_id);

        const fieldNameStore = useFieldNameStore();
        const height_fieldname = fieldNameStore.getHFieldName(req_id);
        const lat_fieldname = fieldNameStore.getLatFieldName(req_id);
        const lon_fieldname = fieldNameStore.getLonFieldName(req_id);

        // console.log(`_duckDbReadOrCacheSummary req_id:${req_id} DEBUG:`, {
        //     height_fieldname,
        //     lat_fieldname,
        //     lon_fieldname,
        //     geometryInfo,
        //     hasGeometry: geometryInfo?.hasGeometry,
        //     colTypes: colTypes.map(c => c.name)
        // });

        const aggCols = [lat_fieldname, lon_fieldname, height_fieldname];
        const aggClauses = buildSafeAggregateClauses(aggCols, getType, duckDbClient.escape, geometryInfo);
        //console.log(`_duckDbReadOrCacheSummary req_id:${req_id} aggClauses:`, aggClauses, ' geometryInfo:', geometryInfo);
        // Add COUNT(*) manually
        const summaryQuery = `
            SELECT
                ${aggClauses.join(',\n')},
                COUNT(*) AS numPoints
            FROM '${fileName}'
        `;

        const results = await duckDbClient.query(summaryQuery);
        //console.log(`_duckDbReadOrCacheSummary req_id:${req_id} summaryQuery:`, summaryQuery,' geometryInfo:', geometryInfo, ' results:', results);
        const rows: SummaryRowData[] = [];

        for await (const chunk of results.readRows()) {
            for (const row of chunk) {
                //console.log(`_duckDbReadOrCacheSummary req_id:${req_id} RAW ROW:`, row);
                // console.log(`_duckDbReadOrCacheSummary req_id:${req_id} HEIGHT KEYS:`, {
                //     heightField: height_fieldname,
                //     minKey: aliasKey("min", height_fieldname),
                //     maxKey: aliasKey("max", height_fieldname),
                //     lowKey: aliasKey("low", height_fieldname),
                //     highKey: aliasKey("high", height_fieldname),
                //     minValue: row[aliasKey("min", height_fieldname)],
                //     maxValue: row[aliasKey("max", height_fieldname)],
                //     allKeys: Object.keys(row)
                // });

                const typedRow: SummaryRowData = {
                    minLat: row[aliasKey("min", lat_fieldname)],
                    maxLat: row[aliasKey("max", lat_fieldname)],
                    minLon: row[aliasKey("min", lon_fieldname)],
                    maxLon: row[aliasKey("max", lon_fieldname)],
                    minHMean: row[aliasKey("min", height_fieldname)],
                    maxHMean: row[aliasKey("max", height_fieldname)],
                    lowHMean: row[aliasKey("low", height_fieldname)],
                    highHMean: row[aliasKey("high", height_fieldname)],
                    numPoints: row.numPoints
                };
                rows.push(typedRow);
            }
        }

        if (rows.length > 0) {
            const row = rows[0];
            localExtLatLon.minLat = row.minLat;
            localExtLatLon.maxLat = row.maxLat;
            localExtLatLon.minLon = row.minLon;
            localExtLatLon.maxLon = row.maxLon;
            localExtHMean.minHMean = row.minHMean;
            localExtHMean.maxHMean = row.maxHMean;
            localExtHMean.lowHMean = row.lowHMean;
            localExtHMean.highHMean = row.highHMean;

            summary = { req_id, extLatLon: localExtLatLon, extHMean: localExtHMean, numPoints: row.numPoints };
            await indexedDb.addNewSummary(summary);
            await indexedDb.updateRequestRecord({ req_id, cnt: row.numPoints }, false);
            useCurReqSumStore().setSummary(summary);
        } else {
            throw new Error('No rows returned');
        }

        const rsummary = await indexedDb.getWorkerSummary(req_id);
        //console.log('_duckDbReadOrCacheSummary returning summary:', rsummary);
        return rsummary;
    } catch (error) {
        console.error('_duckDbReadOrCacheSummary error:', error);
        throw error;
    } finally {
        unlock();
        const endTime = performance.now();
        console.log(`_duckDbReadOrCacheSummary for ${req_id} took ${endTime - startTime} ms.`);
    }
}

export const computeSamplingRate = async(req_id:number): Promise<number> => {
    let sample_fraction = 1.0;
    try{
        const maxNumPnts = useSrParquetCfgStore().getMaxNumPntsToDisplay();
        const summary = await readOrCacheSummary(req_id);
        if(summary){
            const numPointsStr = summary.numPoints;
            const numPoints = parseInt(String(numPointsStr));
            // console.log(`numPoints: ${numPoints}, Type: ${typeof numPoints}`);
            try{
                sample_fraction = maxNumPnts /numPoints; 
            } catch (error) {
                console.error('computeSamplingRate sample_fraction error:', error);
            }
            //console.warn('computeSamplingRate maxNumPnts:', maxNumPnts, ' summary.numPoints:', summary.numPoints, ' numPoints:',numPoints, ' sample_fraction:', sample_fraction);
        } else {
            console.error('computeSamplingRate summary is undefined using 1.0');
        }
    } catch (error) {
        console.error('computeSamplingRate error:', error, 'req_id:', req_id);
    }
    return sample_fraction;
}

function isScalarNumericDuckType(type: string): boolean {
    const T = type.toUpperCase();
    // reject containers
    if (T.includes('LIST') || T.includes('[]') || T.startsWith('STRUCT') || T.startsWith('MAP') || T.startsWith('UNION')) {
        return false;
    }
    // allow numeric scalars
    return /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|REAL|FLOAT|DOUBLE|DECIMAL)/.test(T);
}

export async function prepareDbForReqId(reqId: number): Promise<void> {
    const startTime = performance.now();
    try {
        const fileName = await indexedDb.getFilename(reqId);
        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);

        // Get typed columns and keep only scalar numerics (no arrays/lists)
        const colTypes = await duckDbClient.queryColumnTypes(fileName);
        const scalarNumericCols = colTypes
            .filter(c => isScalarNumericDuckType(c.type))
            .map(c => c.name);

        await updateAllFilterOptions(reqId);
        //console.trace(`prepareDbForReqId reqId:${reqId} colNames:`, scalarNumericCols);
        // Use filtered names so arrays never reach the chart store
        setElevationDataOptionsFromFieldNames(reqId.toString(), scalarNumericCols);
    } catch (error) {
        console.error('prepareDbForReqId error:', error);
        throw error;
    } finally {
        const endTime = performance.now();
        console.log(`prepareDbForReqId for ${reqId} took ${endTime - startTime} milliseconds.`);
    }
}

//This is IceSat-2 specific
export const getColsForRgtYatcFromFile = async (
        req_id: number,
        cols: string[]
    ): Promise<Record<string, any[]> | undefined> => {
    if (!req_id) {
        console.error(`getColsForRgtYatcFromFile ${cols} Bad req_id: ${req_id}`);
        return;
    }
  
    const startTime = performance.now();
    let numRows = 0;
    const rowChunks: ElevationDataItem[] = [];
  
    try {
        if (await indexedDb.getStatus(req_id) === 'error') {
            console.error(`getColsForRgtYatcFromFile ${cols} req_id:${req_id} status is error, SKIPPING!`);
            return;
        }
        const globalChartStore = useGlobalChartStore();
        if( !globalChartStore.y_atc_is_valid()){
            console.error(`getColsForRgtYatcFromFile ${cols} req_id:${req_id} y_atc is invalid, SKIPPING!`);
            return;
        }
        // 1. Initialize DuckDB client
        const duckDbClient = await createDuckDbClient();
    
        // 2. Retrieve the filename/func
        const filename = await indexedDb.getFilename(req_id);
        const rgt = globalChartStore.getRgt();
        const selected_y_atc = globalChartStore.selected_y_atc;
        const y_atc_margin = globalChartStore.y_atc_margin;
    
        // 3. Build the query with (or without) DISTINCT
        //    If you want distinct *row combinations*, keep DISTINCT:
        //       SELECT DISTINCT col1, col2 FROM ...
        //    Or remove DISTINCT to see all matching rows:
        //       SELECT col1, col2 FROM ...
        //
        // Example removing DISTINCT:
        const columnStr = cols.join(', ');
        const queryStr = `
            SELECT DISTINCT ${columnStr}
            FROM read_parquet('${filename}')
            WHERE rgt = ${rgt}
            AND y_atc BETWEEN (${selected_y_atc} - ${y_atc_margin})
                            AND (${selected_y_atc} + ${y_atc_margin})
        `;
    
        // 4. Register the Parquet
        await duckDbClient.insertOpfsParquet(filename);
    
        // 5. Execute the query
        const result = await duckDbClient.queryChunkSampled(queryStr);
        for await (const rowChunk of result.readRows()) {
            if (rowChunk.length > 0) {
            numRows += rowChunk.length;
            rowChunks.push(...rowChunk);
            }
        }
    
    } catch (error) {
        console.error(`getColsForRgtYatcFromFile ${cols} req_id:${req_id} error:`, error);
        throw error;
    } finally {
        if (numRows > 0) {
            console.log(`getColsForRgtYatcFromFile columns: ${cols}`, rowChunks);
        } else {
            console.warn(`getColsForRgtYatcFromFile ${cols} req_id:${req_id} no data items processed`);
        }
        
        // ──────────────────────────────────────────
        // Transform row-based data → column-based data
        // ──────────────────────────────────────────
        if (numRows === 0) {
            return undefined;
        }
    
        // Create an object that will store an array for each column
        const dataByColumn: Record<string, Set<any>> = {};
        cols.forEach((col) => (dataByColumn[col] = new Set()));
        
        // Populate these sets
        for (const row of rowChunks) {
            for (const col of cols) {
            dataByColumn[col].add(row[col]);
            }
        }
        
        // Convert sets back to arrays
        const uniqueDataByColumn: Record<string, any[]> = {};
        for (const col of cols) {
            uniqueDataByColumn[col] = Array.from(dataByColumn[col]);
        }
        
        const endTime = performance.now();
        console.log(`getColsForRgtYatcFromFile ${cols} req_id:${req_id} retrieved ${numRows} rows in ${endTime - startTime} ms.`);
        return uniqueDataByColumn;
    }
};

export async function getRepresentativeElevationPointForReq(
  req_id: number
): Promise<ElevationDataItem | null> {
  const start = performance.now();
  try {
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);

    const fns = useFieldNameStore();
    const rgtCol   = fns.getUniqueTrkFieldName(req_id);
    const cycleCol = fns.getUniqueOrbitIdFieldName(req_id);
    const spotCol  = fns.getUniqueSpotIdFieldName(req_id);

    const esc = duckDbClient.escape;

    const sql = `
      WITH top_combo AS (
        SELECT ${esc(rgtCol)} AS rgt, ${esc(cycleCol)} AS cycle, ${esc(spotCol)} AS spot
        FROM '${fileName}'
        GROUP BY ${esc(rgtCol)}, ${esc(cycleCol)}, ${esc(spotCol)}
        ORDER BY COUNT(*) DESC
        LIMIT 1
      )
      SELECT t.*
      FROM '${fileName}' t
      JOIN top_combo tc
        ON t.${esc(rgtCol)} = tc.rgt
       AND t.${esc(cycleCol)} = tc.cycle
       AND t.${esc(spotCol)} = tc.spot
      LIMIT 1;
    `;

    const q = await duckDbClient.query(sql);
    for await (const chunk of q.readRows()) {
      if (chunk.length > 0) return chunk[0] as ElevationDataItem;
    }
    return null;
  } catch (err) {
    console.error("getRepresentativeElevationPointForReq error:", err);
    return null;
  } finally {
    console.log(
      "getRepresentativeElevationPointForReq took",
      (performance.now() - start).toFixed(1),
      "ms"
    );
  }
}


export const duckDbReadAndUpdateElevationData = async (req_id: number, layerName: string): Promise<ElevationDataItem | null> => {
    console.log('duckDbReadAndUpdateElevationData req_id:', req_id);
    const startTime = performance.now();

    let firstRec: ElevationDataItem | null = null;
    let numRows = 0;
    let srViewName = await indexedDb.getSrViewName(req_id);

    if (!srViewName || srViewName === '' || srViewName === 'Global') {
        srViewName = 'Global Mercator Esri';
        console.error(`HACK ALERT!! inserting srViewName:${srViewName} for reqId:${req_id}`);
    }

    const projName = srViews.value[srViewName].projectionName;

    if (!req_id) {
        console.error('duckDbReadAndUpdateElevationData Bad req_id:', req_id);
        return null;
    }

    const pntData = useAnalysisMapStore().getPntDataByReqId(req_id.toString());
    pntData.isLoading = true;

    try {
        if (await indexedDb.getStatus(req_id) === 'error') {
            console.error('duckDbReadAndUpdateElevationData req_id:', req_id, ' status is error SKIPPING!');
            return null;
        }

        const duckDbClient = await createDuckDbClient();
        const filename = await indexedDb.getFilename(req_id);
        await duckDbClient.insertOpfsParquet(filename);

        // ─────────────────────────────────────────────────────────
        // NEW: pick representative point from top (rgt,cycle,spot)
        //      default: median by x-axis (falls back internally)
        //      alternative: pass "strongest"
        // ─────────────────────────────────────────────────────────
        try {
            const rep = await getRepresentativeElevationPointForReq(req_id);
            if (rep) {
                firstRec = rep;  // <- set early; we still build/render the layer from chunks below
            }
        } catch (e) {
            console.warn('Representative point selection failed; will fall back to first clickable row:', e);
        }

        let rows: ElevationDataItem[] = [];
        let positions: SrPosition[] = []; // Precompute positions
        const pntDataLocal = useAnalysisMapStore().getPntDataByReqId(req_id.toString());
        pntDataLocal.totalPnts = 0;
        pntDataLocal.currentPnts = 0;

        // Get CRS information for coordinate transformation
        const geoMetadata = await getGeoMetadataFromFile(filename);
        const sourceCrs = extractCrsFromGeoMetadata(geoMetadata);
        const requiresTransformation = needsTransformation(sourceCrs);

        if (requiresTransformation && sourceCrs) {
            console.log(`duckDbReadAndUpdateElevationData: Will transform coordinates from ${sourceCrs} to EPSG:4326`);
        } else if (sourceCrs) {
            console.log(`duckDbReadAndUpdateElevationData: No transformation needed, data is in ${sourceCrs}`);
        } else {
            console.log('duckDbReadAndUpdateElevationData: No geo metadata CRS found, assuming coordinates are WGS 84 (EPSG:4326)');
        }

        try {
            const sample_fraction = await computeSamplingRate(req_id);

            // Check if geometry column exists and build appropriate SELECT
            const colTypes = await duckDbClient.queryColumnTypes(filename);
            const hasGeometry = colTypes.some(c => c.name === 'geometry');

            // Get field names from fieldNameStore
            const fieldNameStore = useFieldNameStore();
            const lonField = fieldNameStore.getLonFieldName(req_id);
            const latField = fieldNameStore.getLatFieldName(req_id);
            const heightField = fieldNameStore.getHFieldName(req_id);

            let selectClause: string;
            if (hasGeometry) {
                // Check if Z column exists as a separate column
                // If it does, geometry is 2D (Point) and Z is stored separately
                // If it doesn't, geometry is 3D (Point Z) and Z is in the geometry
                const hasZColumn = colTypes.some(c => c.name === heightField);
                const geometryHasZ = !hasZColumn;  // Z is in geometry if there's no separate Z column

                // Build column list: all columns except geometry (and z column if it's in geometry)
                const nonGeomCols = colTypes
                    .filter(c => {
                        if (c.name === 'geometry') return false;
                        // If Z is in geometry, exclude the separate Z column
                        if (geometryHasZ && c.name === heightField) return false;
                        return true;
                    })
                    .map(c => duckDbClient.escape(c.name));

                // Add geometry extractions with field name aliases
                const geomExtractions = [
                    `ST_X(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(lonField)}`,
                    `ST_Y(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(latField)}`
                ];

                // Only extract Z from geometry if it has Z, otherwise include the separate column
                if (geometryHasZ) {
                    geomExtractions.push(
                        `ST_Z(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(heightField)}`
                    );
                } else {
                    // Z is a separate column, already included in nonGeomCols
                }

                selectClause = [...nonGeomCols, ...geomExtractions].join(', ');
            } else {
                selectClause = '*';
            }

            const queryStr = `SELECT ${selectClause} FROM read_parquet('${filename}')`;
            const result = await duckDbClient.queryChunkSampled(queryStr, sample_fraction);

            if (result.totalRows) {
                pntDataLocal.totalPnts = result.totalRows;
            } else if (result.schema === undefined) {
                console.warn('duckDbReadAndUpdateElevationData totalRows and schema are undefined result:', result);
            }

            const iterator = result.readRows();
            const { value, done } = await iterator.next();

            if (!done && value) {
                rows = value as ElevationDataItem[];
                numRows = rows.length;
                pntDataLocal.currentPnts = numRows;

                // Fallback if representative point was not found
                if (!firstRec) {
                    firstRec = rows.find(isClickable) || null;
                    if (!firstRec && rows.length > 0) {
                        firstRec = rows[0];
                    }
                }

                if (firstRec) {
                    // Transform coordinates from source CRS to WGS 84 (EPSG:4326) if needed
                    positions = rows.map(d => {
                        const lon = d[lonField];
                        const lat = d[latField];

                        if (requiresTransformation && sourceCrs) {
                            const [transformedLon, transformedLat] = transformCoordinate(lon, lat, sourceCrs);
                            return [transformedLon, transformedLat, 0] as SrPosition;
                        } else {
                            return [lon, lat, 0] as SrPosition;
                        }
                    });
                } else {
                    console.warn(`No valid elevation points found in ${numRows} rows.`);
                    useSrToastStore().warn('No Data Processed', `No valid elevation points found in ${numRows} rows.`);
                }
            } else {
                console.warn('duckDbReadAndUpdateElevationData no data items processed');
                useSrToastStore().warn('No Data Processed', 'No data items processed. No Data returned for this region and request parameters.');
            }
        } catch (error) {
            console.error('duckDbReadAndUpdateElevationData error processing chunk:', error);
            throw error;
        }

        if (numRows > 0 && firstRec) {
            const height_fieldname = useFieldNameStore().getHFieldName(req_id);
            const summary = await readOrCacheSummary(req_id);

            if (summary?.extHMean) {
                useCurReqSumStore().setSummary({
                    req_id,
                    extLatLon: summary.extLatLon,
                    extHMean: summary.extHMean,
                    numPoints: summary.numPoints
                });
                updateDeckLayerWithObject(layerName, rows, summary.extHMean, height_fieldname, positions, projName);
            } else {
                console.error('duckDbReadAndUpdateElevationData summary is undefined');
            }

            await prepareDbForReqId(req_id);
        }
    } catch (error) {
        console.error('duckDbReadAndUpdateElevationData error:', error);
        throw error;
    } finally {
        const pntDataFinal = useAnalysisMapStore().getPntDataByReqId(req_id.toString());
        pntDataFinal.isLoading = false;
        const endTime = performance.now();
        console.log(`duckDbReadAndUpdateElevationData for ${req_id} took ${endTime - startTime} milliseconds.`);
        return { firstRec, numRows };
    }
};

type Position = [number, number, number];

export const duckDbReadAndUpdateSelectedLayer = async (
    req_id: number, layerName:string
) => {
    console.log('duckDbReadAndUpdateSelectedLayer req_id:', req_id);
    if (req_id === undefined || req_id === null || req_id === 0) {
        console.error('duckDbReadAndUpdateSelectedLayer Bad req_id:', req_id);
        return;
    }

    const startTime = performance.now();
    const reqIdStr = req_id.toString();
    let numRows = 0;
    const filteredPntData = useAnalysisMapStore().getFilteredPntDataByReqId(reqIdStr);
    const globalChartStore = useGlobalChartStore();

    try {
        if (await indexedDb.getStatus(req_id) === 'error') {
            console.error('duckDbReadAndUpdateSelectedLayer req_id:', req_id, ' status is error SKIPPING!');
            return;
        }

        const utfn = useFieldNameStore().getUniqueTrkFieldName(req_id);
        const uofn = useFieldNameStore().getUniqueOrbitIdFieldName(req_id);
        const usfn = useFieldNameStore().getUniqueSpotIdFieldName(req_id);

        filteredPntData.isLoading = true;
        filteredPntData.currentPnts = 0;

        const duckDbClient = await createDuckDbClient();
        const filename = await indexedDb.getFilename(req_id);
        const func = await indexedDb.getFunc(req_id);
        let queryStr = '';

        // Construct SQL query
        const rgt = globalChartStore.getRgt();
        const cycles = globalChartStore.getCycles();
        const spots = globalChartStore.getSpots();
        let use_y_atc_filter = globalChartStore.use_y_atc_filter;
        let min_y_atc = '0.0';
        let max_y_atc = '0.0';

        if (globalChartStore.selected_y_atc) {
            const y_atc_margin = globalChartStore.y_atc_margin;
            min_y_atc = (globalChartStore.selected_y_atc - y_atc_margin).toFixed(3);
            max_y_atc = (globalChartStore.selected_y_atc + y_atc_margin).toFixed(3);
        } else {
            if(!func.includes('atl08')){
                console.warn('duckDbReadAndUpdateSelectedLayer selected_y_atc is undefined');
            }
            use_y_atc_filter = false;
        }

        await duckDbClient.insertOpfsParquet(filename);

        // Get CRS information for coordinate transformation
        const geoMetadata = await getGeoMetadataFromFile(filename);
        const sourceCrs = extractCrsFromGeoMetadata(geoMetadata);
        const requiresTransformation = needsTransformation(sourceCrs);

        if (requiresTransformation && sourceCrs) {
            console.log(`duckDbReadAndUpdateSelectedLayer: Will transform coordinates from ${sourceCrs} to EPSG:4326`);
        } else if (sourceCrs) {
            console.log(`duckDbReadAndUpdateSelectedLayer: No transformation needed, data is in ${sourceCrs}`);
        } else {
            console.log('duckDbReadAndUpdateSelectedLayer: No geo metadata CRS found, assuming coordinates are WGS 84 (EPSG:4326)');
        }

        // Check if geometry column exists and build appropriate SELECT
        const colTypes = await duckDbClient.queryColumnTypes(filename);
        const hasGeometry = colTypes.some(c => c.name === 'geometry');

        // Get field names from fieldNameStore
        const fieldNameStore = useFieldNameStore();
        const lonField = fieldNameStore.getLonFieldName(req_id);
        const latField = fieldNameStore.getLatFieldName(req_id);
        const heightField = fieldNameStore.getHFieldName(req_id);

        let selectClause: string;
        if (hasGeometry) {
            // Check if Z column exists as a separate column
            // If it does, geometry is 2D (Point) and Z is stored separately
            // If it doesn't, geometry is 3D (Point Z) and Z is in the geometry
            const hasZColumn = colTypes.some(c => c.name === heightField);
            const geometryHasZ = !hasZColumn;  // Z is in geometry if there's no separate Z column

            // Build column list: all columns except geometry (and z column if it's in geometry)
            const nonGeomCols = colTypes
                .filter(c => {
                    if (c.name === 'geometry') return false;
                    // If Z is in geometry, exclude the separate Z column
                    if (geometryHasZ && c.name === heightField) return false;
                    return true;
                })
                .map(c => duckDbClient.escape(c.name));

            // Add geometry extractions with field name aliases
            const geomExtractions = [
                `ST_X(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(lonField)}`,
                `ST_Y(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(latField)}`
            ];

            // Only extract Z from geometry if it has Z, otherwise include the separate column
            if (geometryHasZ) {
                geomExtractions.push(
                    `ST_Z(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(heightField)}`
                );
            } else {
                // Z is a separate column, already included in nonGeomCols
            }

            selectClause = [...nonGeomCols, ...geomExtractions].join(', ');
        } else {
            selectClause = '*';
        }

        queryStr = `
            SELECT ${selectClause} FROM read_parquet('${filename}')
            WHERE ${utfn} = ${rgt}
            AND ${uofn} IN (${cycles.join(', ')})
            AND ${usfn} IN (${spots.join(', ')})
        `;
        if (use_y_atc_filter) {
            queryStr += `AND y_atc BETWEEN ${min_y_atc} AND ${max_y_atc}`;
        }

        const rowChunks: ElevationDataItem[] = [];
        const positions: Position[] = []; // Store precomputed positions

        try {
            const result = await duckDbClient.queryChunkSampled(queryStr); // No sampling for selected

            for await (const rowChunk of result.readRows()) {
                if (rowChunk.length > 0) {
                    numRows += rowChunk.length;
                    rowChunks.push(...rowChunk);
                    filteredPntData.currentPnts = numRows;
                    // **Precompute positions and store them with CRS transformation**
                    rowChunk.forEach(d => {
                        const lon = d[lonField];
                        const lat = d[latField];

                        if (requiresTransformation && sourceCrs) {
                            const [transformedLon, transformedLat] = transformCoordinate(lon, lat, sourceCrs);
                            positions.push([transformedLon, transformedLat, 0]);
                        } else {
                            positions.push([lon, lat, 0]);
                        }
                    });
                }
            }

            if (numRows === 0) {
                console.warn('duckDbReadAndUpdateSelectedLayer no data items processed');
            }
        } catch (error) {
            console.error('duckDbReadAndUpdateSelectedLayer error processing chunk:', error);
            throw error;
        }

        if (numRows > 0) {
            const srViewName = await indexedDb.getSrViewName(req_id);
            const projName = srViews.value[srViewName].projectionName;
            const height_fieldname = useFieldNameStore().getHFieldName(req_id);
            const summary = await readOrCacheSummary(req_id);
            if (summary?.extHMean) {
                // Pass `positions` to the function so it's used efficiently
                updateDeckLayerWithObject(layerName,rowChunks, summary.extHMean, height_fieldname, positions, projName);
            } else {
                console.error('duckDbReadAndUpdateSelectedLayer summary is undefined');
            }
        } else {
            console.warn('duckDbReadAndUpdateSelectedLayer no data items processed');
        }
    } catch (error) {
        console.error('duckDbReadAndUpdateSelectedLayer error:', error);
        throw error;
    } finally {
        filteredPntData.isLoading = false;
        const endTime = performance.now();
        console.log(`duckDbReadAndUpdateSelectedLayer for ${req_id} took ${endTime - startTime} milliseconds.`);
    }
};

export async function isReqFileLoaded(reqId:number): Promise<any> {
    const startTime = performance.now(); // Start time
    let serverReq = '';
    try{
        const fileName = await indexedDb.getFilename(reqId);
        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);
        return await duckDbClient.isParquetLoaded(fileName);
    } catch (error) {
        console.error('duckDbLoadOpfsParquetFile error:',error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`duckDbLoadOpfsParquetFile took ${endTime - startTime} milliseconds.`);
    }
    return serverReq;   
}


export async function duckDbLoadOpfsParquetFile(fileName: string): Promise<any> {
    const startTime = performance.now(); // Start time
    let serverReq = '';
    try{
        //console.log('duckDbLoadOpfsParquetFile');
        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);
        try {
            const serverReqResult =  await duckDbClient.getServerReqFromMetaData(fileName);
            if(serverReqResult){
                serverReq = serverReqResult;
            } else {
                console.warn('duckDbLoadOpfsParquetFile serverReqResult is null');
            }
        } catch (error) {
            console.error('duckDbLoadOpfsParquetFile Error dumping parquet metadata:', error);
        }
    } catch (error) {
        console.error('duckDbLoadOpfsParquetFile error:',error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`duckDbLoadOpfsParquetFile took ${endTime - startTime} milliseconds.`);
    }
    //console.log('duckDbLoadOpfsParquetFile serverReq:', serverReq);
    return serverReq;
}

export async function getGeoMetadataFromFile(fileName: string): Promise<any> {
    const startTime = performance.now();
    let geoMetadata = null;
    try {
        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);
        const metadata = await duckDbClient.getAllParquetMetadata(fileName);

        if (metadata?.geo) {
            try {
                geoMetadata = JSON.parse(metadata.geo);
                console.log('getGeoMetadataFromFile found geo metadata for', fileName);
            } catch (error) {
                console.error('getGeoMetadataFromFile Error parsing geo metadata:', error);
            }
        } else {
            console.log('getGeoMetadataFromFile no geo metadata found for', fileName);
        }
    } catch (error) {
        console.error('getGeoMetadataFromFile error:', error);
    } finally {
        const endTime = performance.now();
        console.log(`getGeoMetadataFromFile took ${endTime - startTime} milliseconds.`);
    }
    return geoMetadata;
}

export interface SrScatterChartData { value: number[] };

export async function getAllRgtOptionsInFile(req_id: number): Promise<SrListNumberItem[]> {
    const startTime = performance.now(); // Start time
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);
    const rgtOptions = [] as SrListNumberItem[];
    try{
        const utfn = useFieldNameStore().getUniqueTrkFieldName(req_id);

        const query = `SELECT DISTINCT ${utfn} FROM '${fileName}' order by  ${utfn} ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        //console.log('getAllRgtOptionsInFile queryResult:', queryResult);
        for await (const rowChunk of queryResult.readRows()) {
            //console.log('getAllRgtOptionsInFile rowChunk:', rowChunk);
            for (const row of rowChunk) {
                if (row) {
                    rgtOptions.push({ label: row[utfn].toString(), value: row[utfn] });
                } else {
                    console.warn('getAllRgtOptionsInFile fetchData rowData is null');
                }
            }
        } 
    } catch (error) {
        console.error('getAllRgtOptionsInFile Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`SrDuckDbUtils.getAllRgtOptionsInFile() took ${endTime - startTime} milliseconds.`,rgtOptions);
    }
    return rgtOptions;
}

export async function getPairs(req_id: number): Promise<number[]> {
    const startTime = performance.now(); // Start time
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);
    const pairs = [] as number[];
    try{
        const query = `SELECT DISTINCT pair FROM '${fileName}' order by pair ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    //console.log('getPairs row:', row);
                    pairs.push(row.pair);
                } else {
                    console.warn('getPairs fetchData rowData is null');
                }
            }
        } 
        //console.log('getPairs pairs:', pairs);
    } catch (error) {
        console.error('getPairs Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`SrDuckDbUtils.getPairs() took ${endTime - startTime} milliseconds.`, pairs);
    }
    return pairs;
}


// These are IceSat-2 specific
export async function getTracks(req_id: number): Promise<number[]> {
    const startTime = performance.now(); // Start time
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    const tracks = [] as number[];
    try{
        const query = `SELECT DISTINCT track FROM '${fileName}' order by track ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    //console.log('getPairs row:', row);
                    tracks.push(row.track);
                } else {
                    console.warn('getTracks fetchData rowData is null');
                }
            }
        } 
        //console.log('getPairs pairs:', pairs);
    } catch (error) {
        console.error('getTracks Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        //console.log(`SrDuckDbUtils.getTracks() took ${endTime - startTime} milliseconds.`);
    }
    return tracks;
}

export async function getScOrient(req_id: number): Promise<number[]> {
    const startTime = performance.now(); // Start time
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    const scOrients = [] as number[];
    try{
        const query = `SELECT DISTINCT sc_orient FROM '${fileName}' order by sc_orient ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    //console.log('getScOrient row:', row);
                    scOrients.push(row.sc_orient);
                } else {
                    console.warn('getScOrient fetchData rowData is null');
                }
            }
        } 
        //console.log('getScOrient scOrients:', scOrients);
    } catch (error) {
        console.error('getScOrient Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        //console.log(`SrDuckDbUtils.getScOrient() took ${endTime - startTime} milliseconds.`);
    }
    return scOrients;
}

// This uses generic field name for cycle to support GEDI 
export async function getAllCycleOptionsInFile(req_id: number): Promise<{ cycles: number[]; cycleOptions: SrListNumberItem[] }> {
    const startTime = performance.now(); // Start time
    const time_fieldname = useFieldNameStore().getTimeFieldName(req_id);
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();


    // Make the parquet file available to DuckDB
    await duckDbClient.insertOpfsParquet(fileName);

    const cycleOptions = [] as SrListNumberItem[];
    const cycles = [] as number[];

    try {
        const uofn = useFieldNameStore().getUniqueOrbitIdFieldName(req_id);
        // Query: get one row per cycle with a single representative time
        // plus all distinct rgts, spots, and gts.
        const query = `
            SELECT 
                ${uofn},
                ANY_VALUE(${duckDbClient.escape(time_fieldname)}) AS time  -- We only need any single time
            FROM '${fileName}'
            GROUP BY ${uofn}
            ORDER BY ${uofn} ASC;
        `;

        // Run the query
        const queryResult: QueryResult = await duckDbClient.query(query);

        // Process the returned rows
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (!row) {
                    console.warn('getAllCycleOptionsInFile rowData is null or undefined');
                    continue;
                }
                
                // Convert time to a locale-based string (e.g. MM/DD/YYYY)
                const timeStr = new Date(row.time).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });

                // Build a label for each cycle
                const value = row[uofn];
                const newLabel = `${value}: ${timeStr}`;

                cycleOptions.push({
                    label: newLabel,
                    value: value
                });
                cycles.push(value);
            }
        }
    } catch (error) {
        console.error('getAllCycleOptionsInFile Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`getAllCycleOptionsInFile took ${endTime - startTime} ms.`, cycles);
    }

    return {cycles, cycleOptions};
}

// This uses generic field name for cycle to support GEDI 
export async function getAllFilteredCycleOptionsFromFile(
    req_id: number,
): Promise<SrListNumberItem[]> {
    const startTime = performance.now(); // Start time

    const fileName = await indexedDb.getFilename(req_id);
    const time_fieldname = useFieldNameStore().getTimeFieldName(req_id);
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);
    const cycles: SrListNumberItem[] = [];
    let whereClause = '';
    
    try {
        // Build the WHERE clause dynamically
        const uofn = useFieldNameStore().getUniqueOrbitIdFieldName(req_id);
        
        whereClause = createWhereClause(req_id);

        const query = `
            SELECT 
            ${uofn} AS cycle, 
            ANY_VALUE(${duckDbClient.escape(time_fieldname)}) AS time 
            FROM '${fileName}'
            ${whereClause}
            GROUP BY ${uofn} 
            ORDER BY ${uofn} ASC;
        `;

        const queryResult: QueryResult = await duckDbClient.query(query);

        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                        const timeStr = new Date(row.time).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });
                    const newLabel = `${row.cycle}: ${timeStr}`;
                    cycles.push({ label: newLabel, value: row.cycle });
                } else {
                    console.warn(
                        'getAllFilteredCycleOptionsFromFile fetchData rowData is null'
                    );
                }
            }
        }

    } catch (error) {
        console.error('getAllFilteredCycleOptionsFromFile Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(
            `getAllFilteredCycleOptionsFromFile took ${endTime - startTime} milliseconds.`,
            ' req_id:',
            req_id,
            ' cycles:',
            cycles,
            'whereClause:',
            whereClause
        );
    }
    return cycles;
}

export async function updateAllFilterOptions(req_id: number): Promise<void> {
    const startTime = performance.now(); // Start time
    try{
        const globalChartStore = useGlobalChartStore();
        const rgts = await getAllRgtOptionsInFile(req_id);
        globalChartStore.setRgtOptions(rgts);
        const retObj = await getAllCycleOptionsInFile(req_id);
        globalChartStore.setCycleOptions(retObj.cycleOptions);
    } catch (error) {
        console.error('updateAllFilterOptions Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`SrDuckDbUtils.updateAllFilterOptions() took ${endTime - startTime} milliseconds.`);
    }
}
export interface FetchScatterDataOptions {
    /** 
     * Extra columns to SELECT in addition to x and y columns.
     * e.g. [ 'segment_dist', 'atl03_cnf', 'atl08_class' ] 
     */
    extraSelectColumns?: string[];
  
    /**
     * A callback to handle row transformation into `[ x, y1, y2, ..., extras ]`.
     * Must populate dataOrderNdx with the order of the columns.
     */
    transformRow?: (
        row: any,
        x: string,
        y: string[],
        minMaxLowHigh: MinMaxLowHigh,
        dataOrderNdx: Record<string, number>,
        orderNdx: number
    ) => [number[],number];
  
    /**
     * A callback for how to set store states for min/max x, or any special logic
     * required during the "min/max" query.
     */
    handleMinMaxRow?: (reqIdStr: string, row: any) => void;
  
    /**
     * Optional override of the default `whereClause`.
     */
    whereClause?: string;
  
    /**
     * Whether to normalize `x` to `[0..(max-min)]` or leave it as is.
     */
    normalizeX?: boolean;

    /**
     * Optional min axis value used by base API. overlayed should use this
     */
    parentMinX?: number;
}
export interface SrScatterChartDataArray {
    data: number[][]; 
}

export function setDataOrder(dataOrderNdx: Record<string, number>, colName: string, orderNdx: number) {
    if(!dataOrderNdx[colName] && !(dataOrderNdx[colName] === 0)){
        dataOrderNdx[colName] = orderNdx;
        //console.log('setDataOrder dataOrderNdx:', dataOrderNdx, ' orderNdx:', orderNdx, ' colName:', colName);
        orderNdx = orderNdx + 1;
    };
    return orderNdx;
}


export async function fetchScatterData(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[],
    options: FetchScatterDataOptions
): Promise<{
    chartData: Record<string, SrScatterChartDataArray>;
    minMaxLowHigh: MinMaxLowHigh;
    normalizedMinMaxValues: MinMaxLowHigh;
    dataOrderNdx: Record<string, number>;
}> {
    const timeField = useFieldNameStore().getTimeFieldName(parseInt(reqIdStr));
    const mission = useFieldNameStore().getMissionForReqId(parseInt(reqIdStr));
    console.log('fetchScatterData reqIdStr:', reqIdStr, ' fileName:', fileName, ' x:', x, ' y:', y, ' options:', options);
    // Ensure 'time' is in the y array
    if (!y.includes(timeField)) {
        y = [...y, timeField];
    }

    // Ensure 'cycle' is in the y array
    if (mission === 'ICESat-2' && !y.includes('cycle')) {
        y = [...y, 'cycle'];
    }
    const {
        extraSelectColumns = [],
        transformRow,
        handleMinMaxRow,
        whereClause = useChartStore().getWhereClause(reqIdStr),
        normalizeX = options.normalizeX ?? false,
    } = options;

    const startTime = performance.now();
    const chartData: Record<string, SrScatterChartDataArray> = {
        [reqIdStr]: { data: [] }
    };

    const duckDbClient = await createDuckDbClient();
    const minMaxLowHigh: MinMaxLowHigh = {};
    let normalizedMinMaxValues: MinMaxLowHigh = {};
    let dataOrderNdx: Record<string, number> = {};
    let orderNdx = 0;

    try {
        // Make sure the file is registered with DuckDB
        await duckDbClient.insertOpfsParquet(fileName);

        const colTypes = await duckDbClient.queryColumnTypes(fileName);
        const getColType = (colName: string) =>
            baseType(colTypes.find((c) => c.name === colName)?.type ?? 'UNKNOWN');

        // Check if geometry column exists and get geometry info
        const reqId = parseInt(reqIdStr);
        const geometryInfo = getGeometryInfo(colTypes, reqId);

        // Get field names for geometry handling
        const fieldNameStore = useFieldNameStore();
        const lon_fieldname = fieldNameStore.getLonFieldName(reqId);
        const lat_fieldname = fieldNameStore.getLatFieldName(reqId);
        const height_fieldname = fieldNameStore.getHFieldName(reqId);
        const hasGeometry = geometryInfo?.hasGeometry ?? false;

        // Only floats get isnan/isinf filters; other types just check IS NOT NULL
        const yNanClauses = y
        .filter((col) => col !== timeField)
        .map((col) => {
            const t = getColType(col);
            let colExpr: string;

            // Check if this column should be extracted from geometry
            if (hasGeometry && col === lon_fieldname) {
                colExpr = `ST_X(${duckDbClient.escape('geometry')})`;
            } else if (hasGeometry && col === lat_fieldname) {
                colExpr = `ST_Y(${duckDbClient.escape('geometry')})`;
            } else if (hasGeometry && geometryInfo?.zCol && col === height_fieldname) {
                colExpr = `ST_Z(${duckDbClient.escape('geometry')})`;
            } else {
                colExpr = duckDbClient.escape(col);
            }

            if (FLOAT_TYPES.has(t)) {
                return `NOT isnan(${colExpr}) AND NOT isinf(${colExpr})`;
            }
            return `${colExpr} IS NOT NULL`;
        });

        const yNanClause = yNanClauses.length ? yNanClauses.join(' AND ') : 'TRUE';

        let finalWhereClause = '';
        if (!whereClause || !whereClause.trim()) {
            finalWhereClause = `WHERE ${yNanClause}`;
        } else {
            const sanitizedExistingClause = whereClause.replace(/^WHERE\s+/i, '');
            finalWhereClause = `WHERE ${sanitizedExistingClause} AND ${yNanClause}`;
        }


        const allAggCols = [x, ...y, ...extraSelectColumns];

        const selectParts = buildSafeAggregateClauses(allAggCols, getColType, duckDbClient.escape, geometryInfo);

        const minMaxQuery = `
            SELECT
                ${selectParts.join(',\n')}
            FROM '${fileName}'
            ${finalWhereClause}
        `;
            
        const queryResultMinMax: QueryResult = await duckDbClient.query(minMaxQuery);
        //console.log('fetchScatterData queryResultMinMax:', queryResultMinMax);
        let minXtoUse;
        if(options.parentMinX){
            minXtoUse = options.parentMinX;
        }
        console.log('fetchScatterData options.parentMinX:',options.parentMinX,'minXtoUse:', minXtoUse);

        for await (const rowChunk of queryResultMinMax.readRows()) {
            //console.log('fetchScatterData rowChunk:', rowChunk);
            for (const row of rowChunk) {
                if (!row) {
                    console.warn('fetchScatterData: rowData is null in min/max query');
                    continue;
                }

                if (handleMinMaxRow) {
                    handleMinMaxRow(reqIdStr, row);
                } else {
                    // Convert to number first if BigInt
                    const rawMinX = typeof row[aliasKey("min", `${x}`)] === 'bigint'
                        ? Number(row[aliasKey("min", `${x}`)])
                        : row[aliasKey("min", `${x}`)];
                    const rawMaxX = typeof row[aliasKey("max", `${x}`)] === 'bigint'
                        ? Number(row[aliasKey("max", `${x}`)])
                        : row[aliasKey("max", `${x}`)];

                    if(options.parentMinX){
                        minXtoUse = options.parentMinX;
                    } else {
                        minXtoUse = rawMinX;
                    }
                    if(minXtoUse === rawMinX){
                        console.log('fetchScatterData minXtoUse:', minXtoUse, `row['min_${x}']:`, rawMinX);
                    } else {
                        console.warn('fetchScatterData minXtoUse:', minXtoUse, `row['min_${x}']:`, rawMinX);
                    }
                    // set min/max in the store
                    useChartStore().setRawMinX(reqIdStr, rawMinX);
                    useChartStore().setMinX(reqIdStr, rawMinX - minXtoUse);
                    useChartStore().setMaxX(reqIdStr, rawMaxX - minXtoUse);
                }

                // Populate minMaxValues, but exclude NaN values (should be unnecessary now that we filter in SQL)
                // Convert to number first if BigInt
                const minX = typeof row[aliasKey("min", `${x}`)] === 'bigint'
                    ? Number(row[aliasKey("min", `${x}`)])
                    : row[aliasKey("min", `${x}`)];
                const maxX = typeof row[aliasKey("max", `${x}`)] === 'bigint'
                    ? Number(row[aliasKey("max", `${x}`)])
                    : row[aliasKey("max", `${x}`)];
                const lowX = typeof row[aliasKey("low", `${x}`)] === 'bigint'
                    ? Number(row[aliasKey("low", `${x}`)])
                    : row[aliasKey("low", `${x}`)];
                const highX = typeof row[aliasKey("high", `${x}`)] === 'bigint'
                    ? Number(row[aliasKey("high", `${x}`)])
                    : row[aliasKey("high", `${x}`)];

                if (!isNaN(minX) && !isNaN(maxX)) {
                    minMaxLowHigh[`x`] = { // genericize the name to x
                        min: minX,
                        max: maxX,
                        low: lowX,
                        high: highX
                    }

                } else {
                    console.log('aliasKey("min", x):',aliasKey("min", `${x}`));
                    console.error('fetchScatterData: min/max x is NaN:', minX, maxX);
                }

                y.forEach((yName) => {
                    // Convert to number first if BigInt
                    const minY = typeof row[aliasKey("min", yName)] === 'bigint'
                        ? Number(row[aliasKey("min", yName)])
                        : row[aliasKey("min", yName)];
                    const maxY = typeof row[aliasKey("max", yName)] === 'bigint'
                        ? Number(row[aliasKey("max", yName)])
                        : row[aliasKey("max", yName)];
                    const lowY = typeof row[aliasKey("low", yName)] === 'bigint'
                        ? Number(row[aliasKey("low", yName)])
                        : row[aliasKey("low", yName)];
                    const highY = typeof row[aliasKey("high", yName)] === 'bigint'
                        ? Number(row[aliasKey("high", yName)])
                        : row[aliasKey("high", yName)];

                    if (!isNaN(minY) && !isNaN(maxY) && !isNaN(lowY) && !isNaN(highY)) {
                        minMaxLowHigh[yName] = { min: minY, max: maxY, low: lowY, high: highY };
                    }
                });

                extraSelectColumns.forEach((colName) => {
                    // Convert to number first if BigInt
                    const minCol = typeof row[aliasKey("min", colName)] === 'bigint'
                        ? Number(row[aliasKey("min", colName)])
                        : row[aliasKey("min", colName)];
                    const maxCol = typeof row[aliasKey("max", colName)] === 'bigint'
                        ? Number(row[aliasKey("max", colName)])
                        : row[aliasKey("max", colName)];
                    const lowCol = typeof row[aliasKey("low", colName)] === 'bigint'
                        ? Number(row[aliasKey("low", colName)])
                        : row[aliasKey("low", colName)];
                    const highCol = typeof row[aliasKey("high", colName)] === 'bigint'
                        ? Number(row[aliasKey("high", colName)])
                        : row[aliasKey("high", colName)];

                    if (!isNaN(minCol) && !isNaN(maxCol) && !isNaN(lowCol) && !isNaN(highCol)) {
                        minMaxLowHigh[colName] = { min: minCol, max: maxCol, low: lowCol, high: highCol };
                    }
                });
            }
        }

        /**
         * 4. Build the main query to fetch rows for x, all y columns, plus extras.
         *    Use the same finalWhereClause so NaNs in y columns are excluded.
         */
        const allColumns = [x, ...y, ...extraSelectColumns]
            .map((col) => {
                // Check if this column should be extracted from geometry
                if (hasGeometry && col === lon_fieldname) {
                    return `ST_X(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(col)}`;
                } else if (hasGeometry && col === lat_fieldname) {
                    return `ST_Y(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(col)}`;
                } else if (hasGeometry && geometryInfo?.zCol && col === height_fieldname) {
                    return `ST_Z(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(col)}`;
                } else {
                    return duckDbClient.escape(col);
                }
            })
            .join(', ');

        let mainQuery = `SELECT ${allColumns} \nFROM '${fileName}'\n${finalWhereClause}`;
        //console.log('fetchScatterData mainQuery:', mainQuery);
        useChartStore().setQuerySql(reqIdStr, mainQuery);
        const totalRowCnt = await duckDbClient.getTotalRowCount(mainQuery);
        //console.log('fetchScatterData totalRowCnt:', totalRowCnt, ' typeof:', typeof totalRowCnt);
        //console.log('fetchScatterData max_pnts_on_plot:', useGlobalChartStore().max_pnts_on_plot, ' typeof:', typeof useGlobalChartStore().max_pnts_on_plot);



        const sample_fraction = useGlobalChartStore().max_pnts_on_plot/Number(totalRowCnt);
        const queryResultMain: QueryResult = await duckDbClient.queryChunkSampled(
            useChartStore().getQuerySql(reqIdStr),
            sample_fraction
        );
        /**
         * 5. For each row, produce an array [ xVal, yVal1, yVal2, ..., extras ]
         *    and push it into chartData[reqIdStr].data
         */
        //console.log('fetchScatterData mainQuery:', mainQuery);
        for await (const rowChunk of queryResultMain.readRows()) {
            //console.log('fetchScatterData rowChunk:', rowChunk);
            //console.log('fetchScatterData transformRow:', transformRow);
            for (const row of rowChunk) {
                if (!row) {
                    console.warn('fetchScatterData: rowData is null in main query');
                    continue;
                }

                let rowValues: number[] = [];

                if (transformRow) {
                    [rowValues, orderNdx] = transformRow(
                        row,
                        x,
                        y,
                        minMaxLowHigh,
                        dataOrderNdx,
                        orderNdx
                    );
                } else {
                    // Default transformation:
                    // Convert to number first if BigInt
                    const xRawVal = typeof row[x] === 'bigint' ? Number(row[x]) : row[x];
                    const xVal = normalizeX ? xRawVal - minXtoUse : xRawVal;
                    rowValues = [xVal];
                    orderNdx = setDataOrder(dataOrderNdx, 'x', orderNdx);

                    y.forEach((yName) => {
                        // Convert to number first if BigInt
                        const yVal = typeof row[yName] === 'bigint' ? Number(row[yName]) : row[yName];
                        rowValues.push(yVal);
                        orderNdx = setDataOrder(dataOrderNdx, yName, orderNdx);
                    });

                    if (extraSelectColumns.length > 0) {
                        extraSelectColumns.forEach((colName) => {
                            // Convert to number first if BigInt
                            const colVal = typeof row[colName] === 'bigint' ? Number(row[colName]) : row[colName];
                            rowValues.push(colVal);
                            orderNdx = setDataOrder(dataOrderNdx, colName, orderNdx);
                        });
                    }
                }

                // Double-check: exclude row if anything is NaN, but this should now be rare
                // since we already filter them out in SQL.
                if (rowValues.some((val) => isNaN(Number(val)))) {
                    console.warn('Skipping row due to NaN values:', rowValues);
                    continue;
                }

                chartData[reqIdStr].data.push(rowValues);
            }
        }

        /**
         * 6. If we are normalizing X, adjust min=0 and max=(max-min).
         */
        normalizedMinMaxValues = { ...minMaxLowHigh };
        if (normalizeX) {
            normalizedMinMaxValues['x'] = {
                min: 0,
                low: 0,
                max: minMaxLowHigh['x'].max - minMaxLowHigh['x'].min,
                high: minMaxLowHigh['x'].high - minMaxLowHigh['x'].min
            };
        }

        const units = x.toLowerCase() === 'latitude' ? 'Degrees' : 'Meters';

        useChartStore().setXLegend(
            reqIdStr,
            `${x} (normalized) - ${units}`
        );
        //console.log('fetchScatterData chartData:', chartData);
        //console.log('fetchScatterData minMaxValues:', minMaxValues);
        //console.log('fetchScatterData normalizedMinMaxValues:', normalizedMinMaxValues);
        //console.log('fetchScatterData dataOrderNdx:', dataOrderNdx);
        return { chartData, minMaxLowHigh, normalizedMinMaxValues, dataOrderNdx };

    } catch (error) {
        console.error('fetchScatterData Error:', error);
        console.trace('fetchScatterData Error:', error);
        return { chartData: {}, minMaxLowHigh: {}, normalizedMinMaxValues: {}, dataOrderNdx: {} };
    } finally {
        const endTime = performance.now();
        console.log(`fetchScatterData took ${endTime - startTime} ms.`);
    }  
}

export async function getAllColumnMinMax(
    reqId: number
): Promise<MinMaxLowHigh> {
    const startTime = performance.now();

    // Get all geometry and type info in one call
    const { geometryInfo, colTypes, getType, fileName, duckDbClient } = await getGeometryInfoWithTypes(reqId);
    const hasGeometry = geometryInfo?.hasGeometry ?? false;

    // Get field names for geometry handling
    const fieldNameStore = useFieldNameStore();
    const lon_fieldname = fieldNameStore.getLonFieldName(reqId);
    const lat_fieldname = fieldNameStore.getLatFieldName(reqId);
    const height_fieldname = fieldNameStore.getHFieldName(reqId);

    // Filter down to known numeric types (exclude geometry blob itself)
    const numericCols = colTypes.filter(c => {
        // Skip the geometry column itself
        if (c.name === 'geometry') return false;

        const t = baseType(c.type);
        return (
            FLOAT_TYPES.has(t) ||
            INT_TYPES.has(t) ||
            DECIMAL_TYPES.has(t) ||
            BOOL_TYPES.has(t) ||      // optional: if you want min/max/percentiles for booleans
            TEMPORAL_TYPES.has(t)     // optional: min/max always; percentiles via epoch casting in buildSafeAggregateClauses
        );
    });

    // If geometry exists, ensure we include lon, lat, height in the column list
    const colNames = numericCols.map(c => c.name);
    if (hasGeometry) {
        // Add geometry-derived columns if not already present
        if (!colNames.includes(lon_fieldname)) colNames.push(lon_fieldname);
        if (!colNames.includes(lat_fieldname)) colNames.push(lat_fieldname);
        if (!colNames.includes(height_fieldname)) colNames.push(height_fieldname);
    }

    if (colNames.length === 0) {
        console.warn(`No numeric columns found in ${fileName}`);
        return {};
    }

    // Use getType from getGeometryInfoWithTypes (already defined above)
    const selectParts = buildSafeAggregateClauses(colNames, getType, duckDbClient.escape, geometryInfo);
    const query = `SELECT ${selectParts.join(', ')} FROM '${fileName}'`;

    const result: MinMaxLowHigh = {};

    try {
        const queryResult = await duckDbClient.query(query);
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                numericCols.forEach(c => {
                    const min = row[aliasKey("min", c.name)];
                    const max = row[aliasKey("max", c.name)];
                    const low = row[aliasKey("low", c.name)];
                    const high = row[aliasKey("high", c.name)];

                    if (min != null && max != null && low != null && high != null) {
                        result[c.name] = { min, max, low, high };
                    }
                });
            }
        }
    } catch (error) {
        console.error('getAllColumnMinMax error:', error);
        throw error;
    }

    const endTime = performance.now();
    console.log( `getAllColumnMinMax took ${endTime - startTime} ms.\nresult:`, result);
    return result;
}
/**
 * For each ATL06 point, creates a single line segment centered at the point (x, y),
 * with length 40m, and a slope determined by dh_fit_dx.
 *
 * @param reqIdStr   The request id string.
 * @param fileName   Parquet file to query.
 * @param xField     Name of the x coordinate field (e.g., segment_dist or longitude).
 * @param yField     Name of the y coordinate field (e.g., h_mean).
 * @param dhFitDxField Name of the field with the segment slope (dh_fit_dx).
 * @param segmentLength The length of each segment in meters (default: 40).
 * @param whereClause Optional WHERE clause to limit rows.
 * @param minX Optional minimum x value to offset the segments.
 * @returns An array of line segments, each defined by two endpoints [[x1, y
 */
export async function getAtl06SlopeSegments(
    fileName: string,
    xField: string,
    yField: string,
    dhFitDxField: string,
    segmentLength: number = 40,
    whereClause: string = '',
    minX?: number // new param!
): Promise<number[][][]> {
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);

    let filters = [];
    if (whereClause) {
        // Remove "WHERE" if present
        const clause = whereClause.replace(/^\s*WHERE\s+/i, '').trim();
        if (clause) filters.push(clause);
    }
    filters.push(`${yField} IS NOT NULL`);
    filters.push(`${dhFitDxField} IS NOT NULL`);

    const sql = `
        SELECT ${xField}, ${yField}, ${dhFitDxField}
        FROM '${fileName}'
        WHERE ${filters.join(' AND ')}
    `.replace(/\s+/g, ' ');

    const lines: number[][][] = [];
    try {
        const queryResult = await duckDbClient.query(sql);
        for await (const chunk of queryResult.readRows()) {
            for (const row of chunk) {
                const rawX = Number(row[xField]);
                const y = Number(row[yField]);
                const slope = Number(row[dhFitDxField]);
                if (!isFinite(rawX) || !isFinite(y) || !isFinite(slope)) continue;

                // Normalize x for alignment with scatter plot
                const x = (typeof minX === 'number') ? rawX - minX : rawX;

                // Calculate line endpoints
                const denom = Math.sqrt(1 + slope * slope);
                const dx = (segmentLength / 2) / denom;
                const dy = slope * dx;

                const x1 = x - dx;
                const y1 = y - dy;
                const x2 = x + dx;
                const y2 = y + dy;

                lines.push([[x1, y1], [x2, y2]]);
            }
        }
    } catch (error) {
        console.error('getAtl06SlopeSegments error:', error);
        throw error;
    }
    return lines;
}
