import { useChartStore } from "@/stores/chartStore";
import { useGlobalChartStore } from "@/stores/globalChartStore";
import { db as indexedDb } from "@/db/SlideRuleDb";
import { fetchScatterData,setDataOrder,getAtl06SlopeSegments } from "@/utils/SrDuckDbUtils";
import { type EChartsOption, type LegendComponentOption } from 'echarts';
import { createWhereClause } from "./spotUtils";
import type { ECharts } from 'echarts/core';
import { duckDbReadAndUpdateSelectedLayer } from '@/utils/SrDuckDbUtils';
import { type SrRunContext } from '@/db/SlideRuleDb';
import type { SrScatterChartDataArray,FetchScatterDataOptions } from '@/utils/SrDuckDbUtils';
import type { WritableComputedRef } from "vue";
import { reactive, computed } from 'vue';
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useRecTreeStore } from "@/stores/recTreeStore";
import { useRequestsStore } from "@/stores/requestsStore";
import { useGradientColorMapStore } from "@/stores/gradientColorMapStore";
import { useAtl03CnfColorMapStore } from "@/stores/atl03CnfColorMapStore";
import { useAtl08ClassColorMapStore } from "@/stores/atl08ClassColorMapStore";
import { useAtl24ClassColorMapStore } from "@/stores/atl24ClassColorMapStore";
import { useDeck3DConfigStore } from "@/stores/deck3DConfigStore";
import { formatKeyValuePair } from '@/utils/formatUtils';
import { SELECTED_LAYER_NAME_PREFIX, type MinMaxLowHigh, type AtlReqParams, type SrSvrParmsUsed } from "@/types/SrTypes";
import { useSymbolStore } from "@/stores/symbolStore";
import { useFieldNameStore } from "@/stores/fieldNameStore";
import { createDuckDbClient } from "@/utils/SrDuckDb";
import { useActiveTabStore } from "@/stores/activeTabStore";
import { useDeckStore } from "@/stores/deckStore";
import { SC_BACKWARD,SC_FORWARD } from "@/sliderule/icesat2";
import { resetFilterUsingSelectedRec } from "@/utils/SrMapUtils";

export const yDataBindingsReactive = reactive<{ [key: string]: WritableComputedRef<string[]> }>({});
export const yDataSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>({});
export const yColorEncodeSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>({});
export const solidColorSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>({});
export const showYDataMenuReactive = reactive<{ [key: string]: WritableComputedRef<boolean> }>({});
export const useSelectedMinMaxReactive = reactive<{ [key: string]: WritableComputedRef<boolean> }>({});


export const selectedCyclesReactive = computed({
    get: (): number[] => {
        const value = useGlobalChartStore().getCycles();
        //console.log(`selectedCyclesReactive[${reqId}] get:`, value);
        return value;
    },
    set: (values: number[]): void => {
        //console.log(`selectedCyclesReactive[${reqId}] set:`, values);
        useGlobalChartStore().setCycles(values);
    },
});

export const selectedRgtReactive = computed({
    get: (): number => {
        const value = useGlobalChartStore().getRgt();
        //console.log(`selectedRgtsReactive[${reqId}] get:`, value);
        return value ? value : 0;
    },
    set: (value: number): void => {
        //console.log(`selectedRgtsReactive[${reqId}] set:`, values);
        useGlobalChartStore().setRgt(value);
    },
});

/**
 * Helper functions for zoom preservation when axis scale changes
 * (e.g., when overlaying photon cloud data)
 */

/**
 * Convert zoom percentage to absolute value range
 * @param zoomStart - Start percentage (0-100)
 * @param zoomEnd - End percentage (0-100)
 * @param axisMin - Axis minimum value
 * @param axisMax - Axis maximum value
 * @returns Object with min and max absolute values
 */
export function percentToAbsoluteRange(
    zoomStart: number,
    zoomEnd: number,
    axisMin: number,
    axisMax: number
): { min: number; max: number } {
    const range = axisMax - axisMin;
    const viewMin = axisMin + (zoomStart / 100) * range;
    const viewMax = axisMin + (zoomEnd / 100) * range;
    return { min: viewMin, max: viewMax };
}

/**
 * Convert absolute value range to zoom percentage
 * @param viewMin - View minimum value
 * @param viewMax - View maximum value
 * @param axisMin - Axis minimum value
 * @param axisMax - Axis maximum value
 * @returns Object with start and end percentages
 */
export function absoluteToPercentRange(
    viewMin: number,
    viewMax: number,
    axisMin: number,
    axisMax: number
): { start: number; end: number } {
    const range = axisMax - axisMin;
    if (range === 0) {
        return { start: 0, end: 100 };
    }

    // Clamp values to axis bounds
    const clampedMin = Math.max(axisMin, Math.min(axisMax, viewMin));
    const clampedMax = Math.max(axisMin, Math.min(axisMax, viewMax));

    const start = ((clampedMin - axisMin) / range) * 100;
    const end = ((clampedMax - axisMin) / range) * 100;

    return {
        start: Math.max(0, Math.min(100, start)),
        end: Math.max(0, Math.min(100, end))
    };
}

/**
 * Save the current absolute view ranges before axis scale changes
 * @param chart - ECharts instance
 */
export function saveAbsoluteZoomRanges(chart: ECharts): void {
    const atlChartFilterStore = useAtlChartFilterStore();

    // Check if we should skip this save (to prevent feedback loop after restoration)
    if (atlChartFilterStore.skipNextZoomSave) {
        console.log('saveAbsoluteZoomRanges: skipping save after restoration to prevent feedback loop');
        atlChartFilterStore.skipNextZoomSave = false;
        return;
    }

    if (!chart) {
        console.log('saveAbsoluteZoomRanges: chart is null, skipping');
        return;
    }

    const options = chart.getOption() as EChartsOption;

    if (!options || !options.xAxis || !options.yAxis) {
        console.log('saveAbsoluteZoomRanges: options not ready, skipping');
        return;
    }

    // Get axis ranges
    const xAxis = Array.isArray(options.xAxis) ? options.xAxis[0] : options.xAxis;
    const yAxis = Array.isArray(options.yAxis) ? options.yAxis[0] : options.yAxis;

    if (!xAxis || !yAxis) {
        console.log('saveAbsoluteZoomRanges: xAxis or yAxis not found, skipping');
        return;
    }

    const xMin = typeof xAxis.min === 'number' ? xAxis.min : 0;
    const xMax = typeof xAxis.max === 'number' ? xAxis.max : 100;
    const yMin = typeof yAxis.min === 'number' ? yAxis.min : 0;
    const yMax = typeof yAxis.max === 'number' ? yAxis.max : 100;


    // Calculate and store absolute view ranges
    const xView = percentToAbsoluteRange(
        atlChartFilterStore.xZoomStart,
        atlChartFilterStore.xZoomEnd,
        xMin,
        xMax
    );
    const yView = percentToAbsoluteRange(
        atlChartFilterStore.yZoomStart,
        atlChartFilterStore.yZoomEnd,
        yMin,
        yMax
    );

    console.log('Saved absolute zoom ranges:', {
        xAxis: { min: xMin, max: xMax },
        yAxis: { min: yMin, max: yMax },
        xView: xView,
        yView: yView
    });
}

/**
 * Update stored absolute view ranges when user manually zooms
 * @param chart - ECharts instance
 */
export function updateViewRangesFromZoom(chart: ECharts): void {
    const atlChartFilterStore = useAtlChartFilterStore();

    if (!chart) {
        console.log('updateViewRangesFromZoom: chart is null, skipping');
        return;
    }

    const options = chart.getOption() as EChartsOption;

    if (!options || !options.xAxis || !options.yAxis) {
        console.log('updateViewRangesFromZoom: options not ready, skipping');
        return;
    }

    // Get axis ranges
    const xAxis = Array.isArray(options.xAxis) ? options.xAxis[0] : options.xAxis;
    const yAxis = Array.isArray(options.yAxis) ? options.yAxis[0] : options.yAxis;

    if (!xAxis || !yAxis) {
        console.log('updateViewRangesFromZoom: xAxis or yAxis not found, skipping');
        return;
    }

    const xMin = typeof xAxis.min === 'number' ? xAxis.min : 0;
    const xMax = typeof xAxis.max === 'number' ? xAxis.max : 100;
    const yMin = typeof yAxis.min === 'number' ? yAxis.min : 0;
    const yMax = typeof yAxis.max === 'number' ? yAxis.max : 100;

    // Get dataZoom configuration
    const dataZoom = Array.isArray(options.dataZoom) ? options.dataZoom : [options.dataZoom];

    // Find X and Y dataZoom components
    let xZoomStart = atlChartFilterStore.xZoomStart;
    let xZoomEnd = atlChartFilterStore.xZoomEnd;
    let yZoomStart = atlChartFilterStore.yZoomStart;
    let yZoomEnd = atlChartFilterStore.yZoomEnd;

    for (const zoom of dataZoom) {
        if (zoom && typeof zoom === 'object') {
            if (zoom.xAxisIndex !== undefined || zoom.orient === 'horizontal') {
                xZoomStart = zoom.start ?? xZoomStart;
                xZoomEnd = zoom.end ?? xZoomEnd;
            }
            if (zoom.yAxisIndex !== undefined || zoom.orient === 'vertical') {
                yZoomStart = zoom.start ?? yZoomStart;
                yZoomEnd = zoom.end ?? yZoomEnd;
            }
        }
    }

    // Update stored zoom percentages
    atlChartFilterStore.xZoomStart = xZoomStart;
    atlChartFilterStore.xZoomEnd = xZoomEnd;
    atlChartFilterStore.yZoomStart = yZoomStart;
    atlChartFilterStore.yZoomEnd = yZoomEnd;

    // Calculate and update absolute view ranges
    const xView = percentToAbsoluteRange(xZoomStart, xZoomEnd, xMin, xMax);
    const yView = percentToAbsoluteRange(yZoomStart, yZoomEnd, yMin, yMax);

    console.log('Updated view ranges from zoom:', {
        xZoom: { start: xZoomStart, end: xZoomEnd },
        yZoom: { start: yZoomStart, end: yZoomEnd },
        xView: xView,
        yView: yView
    });
}

/**
 * Restore zoom percentages based on absolute view ranges and new axis scales
 * @param newXMin - New X-axis minimum
 * @param newXMax - New X-axis maximum
 * @param newYMin - New Y-axis minimum
 * @param newYMax - New Y-axis maximum
 */
export function restoreZoomFromAbsoluteRanges(
    newXMin: number,
    newXMax: number,
    newYMin: number,
    newYMax: number
): void {
    const atlChartFilterStore = useAtlChartFilterStore();

    // Check if we have valid stored view ranges
    if (atlChartFilterStore.xViewMin === null ||
        atlChartFilterStore.xViewMax === null ||
        atlChartFilterStore.yViewMin === null ||
        atlChartFilterStore.yViewMax === null) {
        console.log('No stored view ranges, skipping zoom restoration');
        return;
    }

    // Check if axis ranges have actually changed significantly (>1% change)
    // If not, skip restoration to avoid unnecessary adjustments
    const oldXRange = (atlChartFilterStore.xAxisMax ?? newXMax) - (atlChartFilterStore.xAxisMin ?? newXMin);
    const oldYRange = (atlChartFilterStore.yAxisMax ?? newYMax) - (atlChartFilterStore.yAxisMin ?? newYMin);
    const newXRange = newXMax - newXMin;
    const newYRange = newYMax - newYMin;

    const xRangeChangePercent = Math.abs((newXRange - oldXRange) / oldXRange) * 100;
    const yRangeChangePercent = Math.abs((newYRange - oldYRange) / oldYRange) * 100;

    if (xRangeChangePercent < 1 && yRangeChangePercent < 1) {
        console.log('Axis ranges have not changed significantly, skipping zoom restoration', {
            xRangeChange: xRangeChangePercent.toFixed(2) + '%',
            yRangeChange: yRangeChangePercent.toFixed(2) + '%'
        });
        return;
    }

    // Convert absolute ranges to percentages with new axis scales
    console.log('Converting absolute to percent:', {
        xView: { min: atlChartFilterStore.xViewMin, max: atlChartFilterStore.xViewMax },
        yView: { min: atlChartFilterStore.yViewMin, max: atlChartFilterStore.yViewMax },
        newXAxis: { min: newXMin, max: newXMax },
        newYAxis: { min: newYMin, max: newYMax }
    });

    const xZoom = absoluteToPercentRange(
        atlChartFilterStore.xViewMin,
        atlChartFilterStore.xViewMax,
        newXMin,
        newXMax
    );
    const yZoom = absoluteToPercentRange(
        atlChartFilterStore.yViewMin,
        atlChartFilterStore.yViewMax,
        newYMin,
        newYMax
    );

    console.log('Calculated new zoom percentages:', {
        xZoom: xZoom,
        yZoom: yZoom,
        'Expected Y view': {
            min: newYMin + (yZoom.start / 100) * (newYMax - newYMin),
            max: newYMin + (yZoom.end / 100) * (newYMax - newYMin)
        }
    });

    // Update zoom percentages
    atlChartFilterStore.xZoomStart = xZoom.start;
    atlChartFilterStore.xZoomEnd = xZoom.end;
    atlChartFilterStore.yZoomStart = yZoom.start;
    atlChartFilterStore.yZoomEnd = yZoom.end;

    // Update the stored axis ranges immediately to the NEW ranges
    // The absolute view ranges (xViewMin/Max, yViewMin/Max) stay the same - that's what we're preserving
    // But the axis ranges change because the data extent changed
    atlChartFilterStore.xAxisMin = newXMin;
    atlChartFilterStore.xAxisMax = newXMax;
    atlChartFilterStore.yAxisMin = newYMin;
    atlChartFilterStore.yAxisMax = newYMax;

    // Skip the next save because we've already updated everything here
    // If we don't skip, saveAbsoluteZoomRanges will recalculate the view ranges based on the
    // NEW zoom percentages and NEW axis, which would change the absolute view (wrong!)
    atlChartFilterStore.skipNextZoomSave = true;

    console.log('Restored zoom from absolute ranges:', {
        oldAxis: {
            x: { min: atlChartFilterStore.xAxisMin, max: atlChartFilterStore.xAxisMax },
            y: { min: atlChartFilterStore.yAxisMin, max: atlChartFilterStore.yAxisMax }
        },
        newAxis: {
            x: { min: newXMin, max: newXMax },
            y: { min: newYMin, max: newYMax }
        },
        absoluteView: {
            x: { min: atlChartFilterStore.xViewMin, max: atlChartFilterStore.xViewMax },
            y: { min: atlChartFilterStore.yViewMin, max: atlChartFilterStore.yViewMax }
        },
        oldZoom: {
            x: { start: atlChartFilterStore.xZoomStart, end: atlChartFilterStore.xZoomEnd },
            y: { start: atlChartFilterStore.yZoomStart, end: atlChartFilterStore.yZoomEnd }
        },
        newZoom: {
            x: { start: xZoom.start, end: xZoom.end },
            y: { start: yZoom.start, end: yZoom.end }
        },
        rangeChanges: {
            x: xRangeChangePercent.toFixed(2) + '%',
            y: yRangeChangePercent.toFixed(2) + '%'
        }
    });
}


export interface SrScatterSeriesData{
  series: {
    name: string;
    type: string;
    data: number[][];
    dimensions?: string[];
    large?: boolean;
    largeThreshold?: number;
    animation?: boolean;
    yAxisIndex?: number;
    symbolSize?: number;
    progressive?: number;
    progressiveThreshold?: number;
    progressiveChunkMode?: string;
    itemStyle?: {
        color: string | ((params: any) => string);
    };
    encode?: {
      x: number;
      y: number;
    };
    z?: number;
    // the following is for line series:
    lineStyle?: {
        color: string;
        width: number;
    };
    symbol?: string;
    polyline?: boolean;
  };
  min: number | null;
  max: number | null;  
};

export function getDefaultColorEncoding(reqId:number,parentFuncStr?:string) {
    if(reqId > 0) {
        const func = useRecTreeStore().findApiForReqId(reqId);
        if(func){
            return useFieldNameStore().getDefaultColorEncoding(func,parentFuncStr);
        } else {
            console.warn(`getDefaultColorEncoding: No function found for reqId: ${reqId}. Returning 'solid'.`);
            return 'solid'; // default color encoding
        }
    } else {
        console.warn(`getDefaultColorEncoding: Invalid reqId: ${reqId}. Returning 'solid'.`);
        return 'solid'; // default color encoding
    }
}

export function initializeColorEncoding(reqId:number,parentFuncStr?:string) {
    const reqIdStr = reqId.toString();
    const chartStore = useChartStore();
    if(reqId > 0) {
        chartStore.setSelectedColorEncodeData(reqIdStr, getDefaultColorEncoding(reqId,parentFuncStr));
    }
    //console.log(`initializeColorEncoding reqId:${reqIdStr} parentFuncStr:${parentFuncStr} chartStore.getSelectedColorEncodeData:`, chartStore.getSelectedColorEncodeData(reqIdStr));
}

export function initDataBindingsToChartStore(reqIds: string[]) {
    //console.log('initDataBindingsToChartStore:', reqIds);
    const chartStore = useChartStore();
    reqIds.forEach((reqId) => {
        if (!(reqId in yDataBindingsReactive)) {
            yDataBindingsReactive[reqId] = computed({
                get: () => chartStore.getYDataOptions(reqId),
                set: (value: string[]) => chartStore.setYDataOptions(reqId, value),
            });
        }
        if(!(reqId in yDataSelectedReactive)){
            yDataSelectedReactive[reqId] = computed({
                get: () => chartStore.getSelectedYData(reqId),
                set: (value: string) => chartStore.setSelectedYData(reqId, value),
            });
        }
        if(!(reqId in yColorEncodeSelectedReactive)){
            yColorEncodeSelectedReactive[reqId] = computed({
                get: () => chartStore.getSelectedColorEncodeData(reqId),
                set: (value: string) => chartStore.setSelectedColorEncodeData(reqId, value),
            });
        }
        if(!(reqId in solidColorSelectedReactive)){
            solidColorSelectedReactive[reqId] = computed({
                get: () => chartStore.getSolidSymbolColor(reqId),
                set: (value: string) => chartStore.setSolidSymbolColor(reqId, value),
            });
        }
        if(!(reqId in showYDataMenuReactive)){
            showYDataMenuReactive[reqId] = computed({
                get: () => chartStore.getShowYDataMenu(reqId),
                set: (value: boolean) => chartStore.setShowYDataMenu(reqId, value),
            });
        }
        if(!(reqId in useSelectedMinMaxReactive)){
            useSelectedMinMaxReactive[reqId] = computed({
                get: () => chartStore.getUseSelectedMinMax(reqId),
                set: (value: boolean) => chartStore.setUseSelectedMinMax(reqId, value),
            });
        }
    });
}

interface GetSeriesParams {
    reqIdStr: string;
    fileName: string;
    x: string;
    y: string[];
    fetchOptions: FetchScatterDataOptions; 
    // The name of the function to fetch data:
    fetchData: (
        reqIdStr: string,
        fileName: string,
        x: string,
        y: string[],
        fetchOptions: FetchScatterDataOptions 
    ) => Promise<{
        chartData: Record<string, SrScatterChartDataArray>;
        minMaxLowHigh: MinMaxLowHigh;
        normalizedMinMaxValues: MinMaxLowHigh;
        dataOrderNdx: Record<string, number>;
    }>;
    // The property name for minMax or normalizedMinMax
    minMaxProperty: 'minMaxLowHigh' | 'normalizedMinMaxValues';
    // A function or color for the series item style
    colorFunction?: (params: any) => string;
    // Additional ECharts config
    zValue: number;
    // Logging prefix for console
    functionName: string;
}
  
/**
 * A generic helper for building scatter series.
 */
async function getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions,
    fetchData,
    minMaxProperty,
    colorFunction,
    zValue,
    functionName,
}: GetSeriesParams): Promise<SrScatterSeriesData[]> {
    const startTime = performance.now();
    let yItems: SrScatterSeriesData[] = [];
    const plotConfig = await indexedDb.getPlotConfig();
    const progressiveChunkSize = plotConfig?.progressiveChunkSize ?? 12000;
    const progressiveThreshold = plotConfig?.progressiveChunkThreshold ?? 10000;
    const progressiveChunkMode = plotConfig?.progressiveChunkMode ?? 'sequential';

    try {
        const { chartData = {}, ...rest } = await fetchData(reqIdStr, fileName, x, y, fetchOptions);
        //console.log(`${functionName} ${reqIdStr} ${y}: chartData:`, chartData, 'fetchOptions:', fetchOptions);
        // e.g. choose minMax based on minMaxProperty
        const minMaxLowHigh = rest['minMaxLowHigh'] || {};
        const minMaxValues = rest[minMaxProperty] || {};
        //console.log(`getGenericSeries ${functionName}: minMaxValues:`, minMaxValues);
        const chartStore = useChartStore();
        chartStore.setMinMaxValues(reqIdStr, minMaxValues);
        chartStore.setMinMaxLowHigh(reqIdStr, minMaxLowHigh);
        chartStore.setDataOrderNdx(reqIdStr, rest['dataOrderNdx'] || {});
        const gradientColorMapStore = useGradientColorMapStore(reqIdStr);
        gradientColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {});
        const atl03CnfColorMapStore = await useAtl03CnfColorMapStore(reqIdStr);
        atl03CnfColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {});
        const atl08ClassColorMapStore = await useAtl08ClassColorMapStore(reqIdStr);
        atl08ClassColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {});
        const atl24ClassColorMapStore = await useAtl24ClassColorMapStore(reqIdStr);
        atl24ClassColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {});
        if (Object.keys(chartData).length === 0 || Object.keys(minMaxValues).length === 0) {
            console.warn(`${functionName} ${reqIdStr}: chartData or minMax is empty, skipping processing.`);
            return yItems;
        }
        if(!colorFunction){
            const cedk = chartStore.getSelectedColorEncodeData(reqIdStr);
            let thisColorFunction;
            if(cedk === 'solid'){
                thisColorFunction = (params: any) => chartStore.getSolidSymbolColor(reqIdStr);
            } else {
                //console.log(`getGenericSeries: chartStore.getSelectedColorEncodeData(reqIdStr):`, chartStore.getSelectedColorEncodeData(reqIdStr));
                //console.log(`getGenericSeries: chartStore.getMinMaxValues(reqIdStr):`, chartStore.getMinMaxValues(reqIdStr));
                let minValue = chartStore.getLow(reqIdStr, cedk);
                let maxValue = chartStore.getHigh(reqIdStr, cedk);
                if(!chartStore.getUseSelectedMinMax(reqIdStr)){
                    minValue = useGlobalChartStore().getLow(cedk);
                    maxValue = useGlobalChartStore().getHigh(cedk);
                }
                thisColorFunction = gradientColorMapStore.createGradientColorFunction(cedk,minValue,maxValue);
            }
            colorFunction = thisColorFunction;
        }
        //console.log(`${functionName}: colorFunction:`, colorFunction);
        // Get the selected Y data name
        const ySelectedName = chartStore.getSelectedYData(reqIdStr);

        if (y.includes(ySelectedName)) {
            const yIndex =  gradientColorMapStore.getDataOrderNdx()[ySelectedName];
            const data = chartData[reqIdStr].data; // get raw number[][] data
            const min = minMaxValues[ySelectedName]?.min ?? null;
            const max = minMaxValues[ySelectedName]?.max ?? null;
            //console.log(`${functionName}: Index of selected Y data "${ySelectedName}" in Y array is ${yIndex}. Min: ${min}, Max: ${max}`, data);

            yItems.push({
                series: {
                    name: ySelectedName,
                    type: 'scatter',
                    data: data,
                    dimensions:[...gradientColorMapStore.getDimensions()], 
                    encode: { x: 0, y: yIndex },
                    itemStyle: { color: colorFunction },
                    z: zValue,
                    large: useAtlChartFilterStore().getLargeData(),
                    largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
                    progressive: progressiveChunkSize,
                    progressiveThreshold,
                    progressiveChunkMode,
                    animation: false,
                    yAxisIndex: 0, // only plotting one series i.e. y-axis 0
                    symbolSize: useSymbolStore().getSize(reqIdStr),
                },
                min,
                max,
            });

            const totalPoints = data.length;
            chartStore.setNumOfPlottedPnts(reqIdStr, totalPoints);
        } else {
            console.warn(`getGenericSeries ${functionName} ${reqIdStr} : selected Y data "${ySelectedName}" not found in provided Y array.`);
        }
    } catch (error) {
        console.error(`getGenericSeries ${functionName} ${reqIdStr} Error:`, error);
    } finally {
        const endTime = performance.now();
        console.log(`getGenericSeries ${functionName} ${reqIdStr} took ${endTime - startTime} milliseconds.`);
    }

    return yItems;
}

export async function getSeriesForAtl03sp(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[]
): Promise<SrScatterSeriesData[]> {
    //console.log('getSeriesForAtl03sp reqIdStr:', reqIdStr,'x:',x,'y:',y);
    const chartStore = useChartStore();
    const atl03CnfColorMapStore = await useAtl03CnfColorMapStore(reqIdStr);
    const atl08ClassColorMapStore = await useAtl08ClassColorMapStore(reqIdStr);
    const fetchOptions: FetchScatterDataOptions = {
        normalizeX: false,
        extraSelectColumns: ['segment_dist'],
        /**
         * handleMinMaxRow:
         * Called once for the “min/max” result row. We replicate the logic:
         *    minX = 0
         *    maxX = max_x + max_segment_dist - min_segment_dist - min_x
         * Store it in chartStore, or anywhere you like.
         */
        handleMinMaxRow: (reqId, row) => {
            chartStore.setMinX(reqId, 0);
            chartStore.setMaxX(
                reqId,
                row.max_x + row.max_segment_dist - row.min_segment_dist - row.min_x
            );
        },

        /**
         * transformRow:
         * Called for each record in the main query. Return an array of numbers:
         *  e.g. [ xOffset, y1, y2?, atl03_cnf, atl08_class, yapc_score ]
         *
         * xOffset = row[x] + row.segment_dist - min_segment_dist
         * (We rely on the minMaxValues passed in. By default, fetchScatterData
         * fills minMaxValues['segment_dist'] from the MIN/MAX query.)
         */
        transformRow: (row, xCol, yCols, minMaxLowHigh, dataOrderNdx, orderNdx) => {
            // figure out the offset for X
            const segMin = minMaxLowHigh['segment_dist']?.min || 0;
            const xVal = row[xCol] + row.segment_dist - segMin;
            orderNdx = setDataOrder(dataOrderNdx,'x',orderNdx);

            // Start with [xVal], then push each y
            const out = [xVal];
            for (const yName of yCols) {
                // If one of the yCols is actually "segment_dist" skip it.
                if (yName !== 'segment_dist') {
                    out.push(row[yName]);
                    orderNdx = setDataOrder(dataOrderNdx,yName,orderNdx);
                }
            }
            return [out,orderNdx];
        },
    };
    const cedk = chartStore.getSelectedColorEncodeData(reqIdStr);
    let thisColorFunction; // generic will set it if is not set here
    if(cedk === 'atl03_cnf'){
        thisColorFunction = atl03CnfColorMapStore.cachedColorFunction;
        // test the color function
        //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
        //const c1 = thisColorFunction({data:[-2]});
    } else if(cedk === 'atl08_class'){
        thisColorFunction = atl08ClassColorMapStore.getColorUsingAtl08_class;
    }
    //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);   
    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,             // pass the specialized logic above
        fetchData: fetchScatterData,
        minMaxProperty: 'minMaxLowHigh', // read from minMaxValues rather than normalizedMinMaxValues
        colorFunction: thisColorFunction, 
        zValue: 0,
        functionName: 'getSeriesForAtl03sp', // for the log
    });
}

export async function getSeriesForAtl03x(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[],
    parentMinX?: number
): Promise<SrScatterSeriesData[]> {
    //console.log('getSeriesForAtl03sp reqIdStr:', reqIdStr,'x:',x,'y:',y);
    const chartStore = useChartStore();
    const atl03CnfColorMapStore = await useAtl03CnfColorMapStore(reqIdStr);
    const atl24ClassColorMapStore = await useAtl24ClassColorMapStore(reqIdStr);
    const atl08ClassColorMapStore = await useAtl08ClassColorMapStore(reqIdStr);
    const fetchOptions:FetchScatterDataOptions  = {normalizeX: true, parentMinX: parentMinX};
    const cedk = chartStore.getSelectedColorEncodeData(reqIdStr);
    let thisColorFunction; // generic will set it if is not set here
    if(cedk === 'atl03_cnf'){
        thisColorFunction = atl03CnfColorMapStore.cachedColorFunction;
        // test the color function
        //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
        //const c1 = thisColorFunction({data:[-2]});
    } else if(cedk === 'atl08_class'){
        thisColorFunction = atl08ClassColorMapStore.getColorUsingAtl08_class;
    } else if(cedk === 'atl24_class'){
        thisColorFunction = atl24ClassColorMapStore.getColorUsingAtl24_class;
    }
    //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);   
    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,             // pass the specialized logic above
        fetchData: fetchScatterData,
        minMaxProperty: 'minMaxLowHigh', // read from minMaxValues rather than normalizedMinMaxValues
        colorFunction: thisColorFunction, 
        zValue: 0,
        functionName: 'getSeriesForAtl03x', // for the log
    });
}

async function getSeriesForAtl03vp(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[]
): Promise<SrScatterSeriesData[]> {
const fetchOptions:FetchScatterDataOptions  = {normalizeX: true};
return getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions,
    fetchData: fetchScatterData,         
    minMaxProperty: 'minMaxLowHigh', // note the difference
    zValue: 10,                               
    functionName: 'getSeriesForAtl03vp',
});
}

async function getSeriesForAtl06(
        reqIdStr: string,
        fileName: string,
        x: string,
        y: string[]
): Promise<SrScatterSeriesData[]> {
    const fetchOptions:FetchScatterDataOptions  = {normalizeX: true};
    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,
        fetchData: fetchScatterData,         // function to fetch data
        minMaxProperty: 'normalizedMinMaxValues', // note the difference
        zValue: 10,                               // z value for ATL06
        functionName: 'getSeriesForAtl06',
    });
}

async function getSeriesForAtl08(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[]
): Promise<SrScatterSeriesData[]> {
    const fetchOptions:FetchScatterDataOptions  = {normalizeX: true};
    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,
        fetchData: fetchScatterData,         // function to fetch data
        minMaxProperty: 'normalizedMinMaxValues', 
        zValue: 10,                               // z value for ATL06
        functionName: 'getSeriesForAtl08',
    });
}

async function getSeriesForAtl24(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[]
): Promise<SrScatterSeriesData[]> {
    const fetchOptions:FetchScatterDataOptions  = {normalizeX: true};
    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,
        fetchData: fetchScatterData,         // function to fetch data
        minMaxProperty: 'normalizedMinMaxValues', 
        zValue: 10,                               // z value for ATL24
        functionName: 'getSeriesForAtl24',
    });
}

async function getSeriesForAtl13(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[]
): Promise<SrScatterSeriesData[]> {
    const fetchOptions:FetchScatterDataOptions  = {normalizeX: true};
    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,
        fetchData: fetchScatterData,         // function to fetch data
        minMaxProperty: 'normalizedMinMaxValues', 
        zValue: 10,                               // z value for ATL13
        functionName: 'getSeriesForAtl13',
    });
}


async function getSeriesForGedi(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[]
): Promise<SrScatterSeriesData[]> {
    console.log(`getSeriesForGedi ${reqIdStr} fileName:`,fileName);
const fetchOptions:FetchScatterDataOptions  = {normalizeX: true};
return getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions,
    fetchData: fetchScatterData,         // function to fetch data
    minMaxProperty: 'normalizedMinMaxValues', // note the difference
    zValue: 10,                               // z value for ATL06
    functionName: 'getSeriesForGedi',
});
}

export function clearPlot() {
    const atlChartFilterStore = useAtlChartFilterStore();
    const plotRef = atlChartFilterStore.getPlotRef();
    if (plotRef) {
        if(plotRef.chart){
            plotRef.chart.clear();
            console.log('clearPlot: plotRef.chart cleared');
        } else {
            console.warn('clearPlot: plotRef.chart is undefined');
        }
    } else {
        console.warn('clearPlot: plotRef is undefined');
    }
}

function filterDataForPos(label:any, data:any,lat:string,lon:string) {
    //console.log('filterDataForPos label:', label, 'data:', data);
    //console.log('filterDataForPos BEFORE lat:',  useGlobalChartStore().locationFinderLat, 'lon:', useGlobalChartStore().locationFinderLon);
    if(label === lat){
        useGlobalChartStore().locationFinderLat = data;
    } else if(label === lon){
        useGlobalChartStore().locationFinderLon = data;
    }
    //console.log('filterDataForPos AFTER  lat:',  useGlobalChartStore().locationFinderLat, 'lon:', useGlobalChartStore().locationFinderLon);
}

export function formatTooltip(params: any,latFieldName:string,lonFieldName:string) {
  const paramsData = params.data;
  const paramsDim = params.dimensionNames as string[];
  let ndx = 0;

  const parms = paramsDim
    .map((dim) => {
      const val = paramsData[ndx++];
      filterDataForPos(dim, val,latFieldName,lonFieldName);
      return formatKeyValuePair(dim, val);
    })
    .join('<br>');
    //console.log('formatTooltip parms:', parms);
    return parms;
}

async function getSeriesFor(reqIdStr:string,isOverlay=false) : Promise<SrScatterSeriesData[]>{
    const chartStore = useChartStore();
    const startTime = performance.now(); 
    const fileName = chartStore.getFile(reqIdStr);
    const reqId = Number(reqIdStr);
    const func = useRecTreeStore().findApiForReqId(reqId);
    const x = chartStore.getXDataForChart(reqIdStr);
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);
    const existingColumns = await duckDbClient.queryForColNames(fileName);
    const all_y = chartStore.getYDataOptions(reqIdStr);
    const y = all_y.filter(col => existingColumns.includes(col));
    // console.log('all_y:', all_y);
    // console.log('existingColumns:', existingColumns);
    // console.log('Filtered y:', y);
    // console.log('getSeriesFor Using y:',y);
    if(y.length != all_y.length){
        console.warn(`getSeriesFor ${reqIdStr} y length mismatch: all_y.length=${all_y.length}, existingColumns.length=${existingColumns.length}, y.length=${y.length}`);
    }
    let seriesData = [] as SrScatterSeriesData[];
    let minXToUse;
    if(isOverlay){
        const rc = await indexedDb.getRunContext(reqId);
        if(rc){
            if(rc.parentReqId){
                minXToUse = chartStore.getRawMinX(rc.parentReqId.toString());
                console.log(`getSeriesFor ${reqIdStr} isOverlay: true, minXToUse (from parent:${rc.parentReqId}): ${minXToUse}`);
            }
        }
    }
    try{
        if(fileName){
            if(func==='atl03sp'){
                seriesData = await getSeriesForAtl03sp(reqIdStr, fileName, x, y);
            } else if(func==='atl03vp'){
                seriesData = await getSeriesForAtl03vp(reqIdStr, fileName, x, y);
            } else if(func==='atl03x'){
                seriesData = await getSeriesForAtl03x(reqIdStr, fileName, x, y, minXToUse);
            } else if((func.includes('atl06') || func.includes('atl03x-surface'))){
                seriesData = await getSeriesForAtl06(reqIdStr, fileName, x, y);
            } else if(func.includes('atl08') || func.includes('atl03x-phoreal')){
                seriesData = await getSeriesForAtl08(reqIdStr, fileName, x, y);
            } else if(func.includes('atl24')){
                seriesData = await getSeriesForAtl24(reqIdStr, fileName, x, y);
            } else if(func.includes('atl13')){
                seriesData = await getSeriesForAtl13(reqIdStr, fileName, x, y); // TBD??
            } else if(func.includes('gedi')){
                seriesData = await getSeriesForGedi(reqIdStr, fileName, x, y);
            } else {
                console.error(`getSeriesFor ${reqIdStr} invalid func:`, func);
            }
            if(seriesData.length === 0){
                console.warn(`getSeriesFor ${reqIdStr} seriesData is empty`);
            }
            //console.log(`getSeriesFor ${reqIdStr} seriesData:`, seriesData);
        } else {
            console.warn(`getSeriesFor ${reqIdStr} fileName is null`);
        }
    } catch (error) {
        console.error('getSeriesFor Error:', error);
    } finally {
        const endTime = performance.now(); 
        console.log(`getSeriesFor ${reqIdStr} fileName:${fileName} took ${endTime - startTime} milliseconds. seriesData.length:`, seriesData.length);
        //console.log(`getSeriesFor ${reqIdStr} seriesData:`, seriesData);
    }
    return seriesData;
}

export async function initChartStoreFor(reqId:number) : Promise<boolean>{
    const chartStore = useChartStore();
    const reqIdStr = reqId.toString();
    let status = true;
    if (reqId <= 0) {
        console.warn('Invalid request ID:', reqId);
        return false;
    }

    try {

        initializeColorEncoding(reqId);
        const request = await indexedDb.getRequest(reqId);

        if (!request) {
            console.error(`No request found for reqId: ${reqIdStr}`, request);
            return false;
        }

        const { file, func, description, num_bytes, cnt, parameters } = request;

        if (file) {
            chartStore.setFile(reqIdStr, file);

        } else {
            console.error(`No file found for reqId: ${reqIdStr}`, request);
            status = false;
        }

        if (description) {
            chartStore.setDescription(reqIdStr, description);
        } // No warning needed for missing description.

        if (num_bytes) {
            chartStore.setSize(reqIdStr, num_bytes);
        } else {
            if(num_bytes===undefined){
                console.error(`No num_bytes found for reqId: ${reqIdStr}`, request);
                status = false;
            }
        }

        if (cnt) {
            chartStore.setRecCnt(reqIdStr, cnt);
        } else {
            if(cnt===undefined){
                console.error(`No cnt found for reqId: ${reqIdStr}`, request);
                status = false;
            }
        }
        if(parameters){
            const parms = parameters as AtlReqParams;
            if(parms){
                //console.log(`initChartStoreFor ${reqIdStr} setting parameters:`, parms);
                chartStore.setParameters(reqIdStr, parms);
            } else {
                console.warn(`No parameters found for reqId: ${reqIdStr}`, request);
                status = false;
            }
        }
    } catch (error) {
        console.error(`Error processing reqId: ${reqIdStr}`, error);
        status = false;
    }
    return status;
}

export async function initChartStore() {
    const startTime = performance.now(); 
    const recTreeStore = useRecTreeStore();
    for (const reqIdItem of recTreeStore.reqIdMenuItems) {
        const reqId = Number(reqIdItem.value);
        const status = await initChartStoreFor(reqId);
        if(!status){
            console.error(`initChartStoreFor ${reqId} failed`);
        }
        await initSymbolSize(reqId);
    }
    const endTime = performance.now(); 
    console.log(`initChartStore took ${endTime - startTime} milliseconds.`);
}

export function slopeRenderItem(_params:any, api:any) {
    const x1 = api.coord([api.value(0), api.value(1)]);
    const x2 = api.coord([api.value(2), api.value(3)]);
    return {
        type: 'line',
        shape: {
            x1: x1[0],
            y1: x1[1],
            x2: x2[0],
            y2: x2[1]
        },
        style: api.style({
            stroke: '#60a5fa', // Light blue (matches points)
            lineWidth: 1.0
        })
    };
}


export function attachRenderItem(option: any) {
    if (option.series && Array.isArray(option.series)) {
        for (const s of option.series) {
            if (s.type === 'custom' && s.name === 'dh_fit_dx Slope') {
                s.renderItem = slopeRenderItem;
            }
        }
    }
}

export async function getScatterOptions(req_id:number): Promise<any> {
    const chartStore = useChartStore();
    const globalChartStore = useGlobalChartStore();
    const atlChartFilterStore = useAtlChartFilterStore();
    const startTime = performance.now(); 
    const reqIdStr = req_id.toString();
    const fileName = chartStore.getFile(reqIdStr);
    const y = chartStore.getYDataOptions(reqIdStr);
    const x = chartStore.getXDataForChart(reqIdStr);
    const rgt = globalChartStore.getRgt();
    const cycles = useGlobalChartStore().getCycles();
    const spots = globalChartStore.getSpots();
    const latFieldName = useFieldNameStore().getLatFieldName(req_id);
    const lonFieldName = useFieldNameStore().getLonFieldName(req_id);
    const mission = useFieldNameStore().getMissionForReqId(req_id);
    const initLegendUnselected = chartStore.getInitLegendUnselected(reqIdStr);
    // Get the CSS variable value dynamically
    const primaryButtonColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--p-button-text-primary-color')
        .trim(); // Retrieve and trim the color value

    //console.log(`getScatterOptions for reqId:${reqIdStr} xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
    let options = null;
    try{
        let seriesData = [] as SrScatterSeriesData[];
        let slopeSeries = null;
        if(mission === 'ICESat-2'){
            if(fileName){
                if(spots.length>0 && rgt>0 && cycles.length>0){
                    seriesData = await getSeriesFor(reqIdStr);
                    if(useAtlChartFilterStore().showSlopeLines){
                        //console.log(`getSeriesFor ${reqIdStr} showSlopeLines is true, adding slope lines`);
                        const minX = chartStore.getRawMinX(reqIdStr); // Use *raw* min, not normalized
                        const svr_params = await indexedDb.getSvrParams(req_id) as SrSvrParmsUsed;
                        if(svr_params){
                            //console.log(`getScatterOptions ${reqIdStr} CURRENT parms:`, svr_params);
                            const segmentLength = svr_params?.len;
                            const whereClause = chartStore.getWhereClause(reqIdStr);
                            //console.log(`getScatterOptions ${reqIdStr} minX: ${minX} segmentLength: ${segmentLength} whereClause: ${whereClause}`);
                            const slopeLines = await getAtl06SlopeSegments(fileName, x, useFieldNameStore().getHFieldName(req_id), 'dh_fit_dx', segmentLength, whereClause, minX);
                            //console.log(`getSeriesFor ${reqIdStr} slopeLines (${slopeLines.length}):`, slopeLines);
                            const slopeLineItems = slopeLines.map(seg => [seg[0][0], seg[0][1], seg[1][0], seg[1][1]]);
                            if(slopeLineItems && slopeLineItems.length > 0){
                                slopeSeries = {
                                    type: 'custom',
                                    name: 'dh_fit_dx Slope',
                                    coordinateSystem: 'cartesian2d',
                                    data: slopeLineItems,
                                    renderItem: slopeRenderItem,
                                    z: 11
                                };
                            
                                //console.log(`getSeriesFor ${reqIdStr} adding slopeLines series:`, slopeSeries);
                            } else {
                                console.warn(`getSeriesFor ${reqIdStr} showSlopeLines is true but no slope lines found`);
                            }
                        } else {
                            console.warn(`getSeriesFor ${reqIdStr} showSlopeLines is true but no svr_params found`);
                        }
                    }
                } else {
                    console.warn('getScatterOptions Filter not set i.e. spots, rgts, or cycles is empty');
                }
            }
        } else if(mission === 'GEDI'){
            if(fileName){
                seriesData = await getSeriesFor(reqIdStr);
            }

        } else {
            console.error(`getScatterOptions ${reqIdStr} mission:${mission} not supported`);
        }
        if(seriesData.length !== 0){
            for(const pt of slopeSeries?.data ?? []) {
                if(Array.isArray(pt) && (!isFinite(pt[0]) || !isFinite(pt[1]))) {
                    console.warn("Bad point:", pt);
                }
            }

            const legendNames = [
                ...seriesData.map(series => series.series.name),
                ...(slopeSeries ? [slopeSeries.name] : [])
            ];
            options = {
                title: {
                    text: globalChartStore.titleOfElevationPlot,
                    left: "center"
                },
                toolbox: {
                    show: true,
                    orient: "vertical",
                    left: 0,
                    top: 50,
                    feature: {
                        saveAsImage: {},
                        restore: {},
                        dataZoom: {},
                        dataView: { readOnly: true },
                    }
                },
                tooltip: {
                    trigger: "item",
                    formatter: (params: any) => formatTooltip(params,latFieldName,lonFieldName),
                },
                legend: {
                    data: legendNames,
                    selected: Object.fromEntries(
                        legendNames.map(name => [name, !initLegendUnselected])
                    ),
                    selectedMode: !initLegendUnselected,
                    left: 'left',
                    itemStyle: { color: primaryButtonColor }
                },
                notMerge: true,
                lazyUpdate: true,
                xAxis: [{
                    min: chartStore.getMinX(reqIdStr),
                    max: chartStore.getMaxX(reqIdStr),
                    name: chartStore.getXLegend(reqIdStr), // Add the label for the x-axis here
                    nameLocation: 'middle', // Position the label in the middle of the axis
                    nameTextStyle: {
                        fontSize: 10,
                        padding:[10,0,10,0],
                        margin:10,
                    },
                    axisLine:  {
                            onZero: false,
                    },
                }],
                yAxis: [{
                    type: 'value',
                    name: seriesData.map(s => s.series.name).join(', '),
                    min: Math.min(...seriesData.map(s => s.min).filter((m): m is number => m !== null)),
                    max: Math.max(...seriesData.map(s => s.max).filter((m): m is number => m !== null)),
                    scale: true,  // Add this to ensure the axis scales correctly
                    axisLabel: {
                        formatter: (value: number) => value.toFixed(1)  // Format to one decimal place
                    }
                }],
                series:[
                            ...seriesData.map(series => series.series),
                            ...(slopeSeries ? [slopeSeries] : [])
                        ],
                dataZoom: [
                    {
                        type: 'slider', // This creates a slider to zoom in the X-axis
                        xAxisIndex: 0,
                        filterMode: 'filter',
                        bottom: 1,
                        start: atlChartFilterStore.xZoomStart, // Start zoom level
                        end: atlChartFilterStore.xZoomEnd, // End zoom level
                    },
                    {
                        type: 'slider', // This creates a slider to zoom in the Y-axis
                        yAxisIndex: seriesData.length > 1 ? [0, 1] : 0, // Adjusting for multiple y-axes if necessary
                        filterMode: 'filter',
                        left: '95%',
                        width: 20,
                        start: atlChartFilterStore.yZoomStart, // Start zoom level
                        end: atlChartFilterStore.yZoomEnd, // End zoom level
                        showDataShadow: false,
                    },
                    {
                        type: 'inside', // This allows zooming inside the chart using mouse wheel or touch gestures
                        xAxisIndex: 0,
                        filterMode: 'filter',
                        start: atlChartFilterStore.xZoomStart, // Start zoom level
                        end: atlChartFilterStore.xZoomEnd, // End zoom level
                    },
                    {
                        type: 'inside', // This allows zooming inside the chart using mouse wheel or touch gestures
                        yAxisIndex: seriesData.length > 1 ? [0, 1] : 0,
                        filterMode: 'filter',
                        start: atlChartFilterStore.yZoomStart, // Start zoom level
                        end: atlChartFilterStore.yZoomEnd, // End zoom level
                    },
                ],            
            };
        } else {
            console.warn('getScatterOptions seriesData is empty');
        }
        //console.log('getScatterOptions options:', options);
    } catch (error) {
        console.error('getScatterOptions Error:', error);
    } finally {
        //console.log(`getScatterOptions options for: ${reqIdStr}:`, options);
        const endTime = performance.now(); 
        console.log(`getScatterOptions fileName:${fileName} took ${endTime - startTime} milliseconds.`,options);
        return options;
    }
}

export async function getScatterOptionsFor(reqId:number) {
    const atlChartFilterStore = useAtlChartFilterStore();
    //console.log(`getScatterOptionsFor for reqId:${reqId} xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
    const newScatterOptions = await getScatterOptions(reqId);
    if (!newScatterOptions) {
        atlChartFilterStore.setShowMessage(true);
        atlChartFilterStore.setIsWarning(true);
        atlChartFilterStore.setMessage(`reqId:${reqId} Failed to load data. Click on elevation in map to preset filters`);
        console.error(`getScatterOptionsFor ${reqId} Failed to load data. Click on elevation in map to preset filters`);
        return;
    }
    const plotRef = atlChartFilterStore.getPlotRef();

    if (Object.keys(newScatterOptions).length > 0) {
        if(plotRef?.chart){
            attachRenderItem(newScatterOptions);
            plotRef.chart.setOption(newScatterOptions,{notMerge: true });
            console.log(`getScatterOptionsFor Options applied to chart:`, newScatterOptions);
            const options = plotRef.chart.getOption();
            console.log(`getScatterOptionsFor ${reqId} Options from chart:`, options);

            // Save absolute zoom ranges AFTER the new options are applied
            // This ensures we save based on the NEW axis ranges, not the old ones
            saveAbsoluteZoomRanges(plotRef.chart);
        } else {
            console.error(`getScatterOptionsFor ${reqId} plotRef.chart is undefined`);
        }
    } else {
        console.warn(`getScatterOptionsFor No valid options to apply to chart`);
    }
}

const initScatterPlotWith = async (reqId: number) => {
    const startTime = performance.now();
    const atlChartFilterStore = useAtlChartFilterStore();
    const chartStore = useChartStore();
    //console.log(`initScatterPlotWith ${reqId} startTime:`, startTime);

    if (reqId === undefined || reqId <= 0) {
        console.error(`initScatterPlotWith ${reqId} reqId is empty or invalid`);
        return;
    }
    await updateWhereClauseAndXData(reqId);
    const reqIdStr = reqId.toString();
    const y_options = chartStore.getYDataOptions(reqIdStr);
    const plotRef = atlChartFilterStore.getPlotRef();
    if (!plotRef?.chart) {
        console.warn(`appendSeries(${reqId.toString()}): plotRef or chart is undefined.`);
        return;
    }
    // Save the current zoom state of the chart before applying new options
    const chart: ECharts = plotRef.chart;
    const options = chart.getOption() as EChartsOption;
    //console.log(`initScatterPlotWith ${reqId} BEFORE options:`, options);
    const zoomCntrls = Array.isArray(options?.dataZoom) ? options.dataZoom : [options?.dataZoom];
    for(let zoomNdx = 0; zoomNdx < zoomCntrls.length; zoomNdx++) {
        const zoomCntrl = zoomCntrls[zoomNdx];//console.log(`initScatterPlotWith ${reqId} zoomCntrls[${zoomNdx}]:`, zoomCntrls[zoomNdx]);            
        if(zoomCntrl) {
            zoomCntrl.filterMode = 'filter'; 
            //console.log(`initScatterPlotWith ALL ${reqId} zoomCntrls[${zoomNdx}]:`, zoomCntrl);
            if(zoomCntrl.start){
                console.log(`initScatterPlotWith ${reqId} zoomCntrls[${zoomNdx}].start:`, zoomCntrl.start);
                if(zoomCntrl.xAxisIndex !== undefined){
                    atlChartFilterStore.xZoomStart = zoomCntrl.start;
                    //console.log(`initScatterPlotWith ${reqId} xZoomStart:`, atlChartFilterStore.xZoomStart);
                }
                if(zoomCntrl.yAxisIndex !== undefined){
                    atlChartFilterStore.yZoomStart = zoomCntrl.start;
                    //console.log(`initScatterPlotWith ${reqId} yZoomStart:`, atlChartFilterStore.yZoomStart);
                }
            }
            if(zoomCntrl.end){
                console.log(`initScatterPlotWith ${reqId} zoomCntrls[${zoomNdx}].end:`, zoomCntrl.end);
                if(zoomCntrl.xAxisIndex !== undefined){
                    atlChartFilterStore.xZoomEnd = zoomCntrl.end;
                    //console.log(`initScatterPlotWith ${reqId} xZoomEnd:`, atlChartFilterStore.xZoomEnd);
                }
                if(zoomCntrl.yAxisIndex !== undefined){
                    atlChartFilterStore.yZoomEnd = zoomCntrl.end;
                    //console.log(`initScatterPlotWith ${reqId} yZoomEnd:`, atlChartFilterStore.yZoomEnd);
                }
            } 
        }
    }
    //console.log(`initScatterPlotWith for reqId:${reqId} SAVED VALUES: xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);

    //console.log(`initScatterPlotWith ${reqId} y_options:`, y_options);
    const msg = '';
    atlChartFilterStore.setShowMessage(false);
    if (!y_options.length || y_options[0] === 'not_set') {
        console.warn(`initScatterPlotWith ${reqId} No y options selected`);
        atlChartFilterStore.setShowMessage(true);
        atlChartFilterStore.setIsWarning(true);
        atlChartFilterStore.setMessage('No Y options selected');
    } else {
        try {
            atlChartFilterStore.setIsLoading();
            clearPlot();
            //console.log(`initScatterPlotWith for reqId:${reqId} AFTER CLEARPLOT xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
            await getScatterOptionsFor(reqId)
        } catch (error) {
            console.error(`initScatterPlotWith ${reqId} Error fetching scatter options:`, error);
            atlChartFilterStore.setShowMessage(true);
            atlChartFilterStore.setMessage('Failed to load data. Please try again later.');
        } finally {
            atlChartFilterStore.resetIsLoading();
        }
    }
    const endTime = performance.now();
    console.log(`initScatterPlotWith ${reqId} took ${endTime - startTime} milliseconds.`);
};

// This removes the defaulted values of unused toolbox, visualMap, timeline, and calendar options from the options object
function removeUnusedOptions(options:any):any { 
    if (!options) {
        return {};
    }
    delete options.visualMap;
    delete options.timeline;
    delete options.calendar;
    //console.log('removeUnusedOptions returning options:', options);
    return options;
}

async function appendSeries(reqId: number): Promise<void> {
    try {
        console.log(`appendSeries(${reqId})`);
        const reqIdStr = reqId.toString();
        const plotRef = useAtlChartFilterStore().getPlotRef();
        if (!plotRef?.chart) {
            console.warn(`appendSeries(${reqIdStr}): plotRef or chart is undefined.`);
            return;
        }
        const chart: ECharts = plotRef.chart;

        // Save the current zoom state before modifying the chart
        const atlChartFilterStore = useAtlChartFilterStore();

        // Retrieve existing options from the chart
        const existingOptions = chart.getOption() as EChartsOption;
        const filteredOptions = removeUnusedOptions(existingOptions);
        //console.log(`appendSeries(${reqIdStr}): existingOptions:`,existingOptions,` filteredOptions:`, filteredOptions);
        // Fetch series data for the given reqIdStr
        const seriesData = await getSeriesFor(reqIdStr,true);//isOverlay=true
        if (!seriesData.length) {
            console.warn(`appendSeries(${reqIdStr}): No series data found.`);
            return;
        }
        //console.log(`appendSeries(${reqIdStr}): seriesData:`, seriesData);
        // Define the fields that should share a single axis
        const heightFields = ['height', 'h_mean', 'h_mean_canopy', 'h_li', 'ortho_h', 'h_min_canopy', 'h_max_canopy', 'h_te_median' ];

        // Separate series into "height" group and "non-height" group
        const heightSeriesData = seriesData.filter(d => heightFields.includes(d.series.name));
        const nonHeightSeriesData = seriesData.filter(d => !heightFields.includes(d.series.name));
        //console.log(`appendSeries(${reqIdStr}): heightSeriesData:`, heightSeriesData);
        //console.log(`appendSeries(${reqIdStr}): nonHeightSeriesData:`, nonHeightSeriesData);
        let updatedSeries = [
            ...(Array.isArray(filteredOptions.series) ? filteredOptions.series : []),
        ];

        let updatedYAxis = Array.isArray(filteredOptions.yAxis)
            ? [...filteredOptions.yAxis]
            : [];

        // -----------------------------
        //     HANDLE Y-AXES MERGING
        // -----------------------------
        let heightYAxisIndex: number | null = null;
        let existingHeightFields: string[] = [];
        let existingHeightMin = Number.POSITIVE_INFINITY;
        let existingHeightMax = Number.NEGATIVE_INFINITY;

        // Identify an existing height axis by checking its name against known height fields
        for (let i = 0; i < updatedYAxis.length; i++) {
            const axis = updatedYAxis[i];
            if (axis && axis.name) {
                const axisNames = axis.name.split(',').map((n: string) => n.trim());
                if (axisNames.some((n: string) => heightFields.includes(n))) {
                    heightYAxisIndex = i;
                    existingHeightFields = axisNames;
                    // Extract current min/max if numeric
                    if (axis.min !== undefined && typeof axis.min === 'number') {
                        existingHeightMin = axis.min;
                    }
                    if (axis.max !== undefined && typeof axis.max === 'number') {
                        existingHeightMax = axis.max;
                    }
                    break;
                }
            }
        }

        // If we have height series, we need to either update or create a height axis
        if (heightSeriesData.length > 0) {
            let heightMin = Number.POSITIVE_INFINITY;
            let heightMax = Number.NEGATIVE_INFINITY;
            let heightNames: string[] = [];

            heightSeriesData.forEach(d => {
                if (d.min && (d.min < heightMin)) heightMin = d.min;
                if (d.max && (d.max > heightMax)) heightMax = d.max;
                heightNames.push(d.series.name);
            });

            if (heightYAxisIndex !== null) {
                // Update existing height axis
                const allHeightFieldsCombined = Array.from(
                    new Set([...existingHeightFields, ...heightNames])
                );
                const combinedMin = Math.min(existingHeightMin, heightMin);
                const combinedMax = Math.max(existingHeightMax, heightMax);

                updatedYAxis[heightYAxisIndex] = {
                    ...updatedYAxis[heightYAxisIndex],
                    name: allHeightFieldsCombined.join(', '),
                    min: combinedMin,
                    max: combinedMax,
                };
            } else {
                // No existing height axis - create a new one
                heightYAxisIndex = updatedYAxis.length;
                updatedYAxis.push({
                    type: 'value',
                    name: heightNames.join(', '), // Concatenate height-related field names
                    min: heightMin,
                    max: heightMax,
                    scale: true,
                    axisLabel: {
                        formatter: (value: number) => value.toFixed(1),
                    },
                });
            }

            // Assign all height series to the identified (or newly created) height axis
            const mappedHeightSeries = heightSeriesData.map(d => ({
                ...d.series,
                type: 'scatter',
                yAxisIndex: heightYAxisIndex as number,
            }));
            updatedSeries = updatedSeries.concat(mappedHeightSeries);
        }

        // For non-height data, each one gets its own axis as a new axis
        const mappedNonHeightSeries = nonHeightSeriesData.map(d => {
            const nonHeightAxisIndex = updatedYAxis.length;
            updatedYAxis.push({
                type: 'value',
                name: d.series.name,
                min: d.min,
                max: d.max,
                scale: true,
                axisLabel: {
                    formatter: (value: number) => value.toFixed(1),
                },
            });
            return {
                ...d.series,
                type: 'scatter',
                yAxisIndex: nonHeightAxisIndex,
            };
        });
        updatedSeries = updatedSeries.concat(mappedNonHeightSeries);

        // -----------------------------
        //     UPDATE LEGEND
        // -----------------------------
        // 1) Grab existing legend from filteredOptions (could be array or object).
        const existingLegend = filteredOptions.legend;
        let updatedLegend: LegendComponentOption[] = [];

        if (Array.isArray(existingLegend) && existingLegend.length > 0) {
            // If the chart uses an array of legend configs, clone them:
            updatedLegend = existingLegend.map(legendObj => {
                // Convert legendObj.data to an array or fallback to empty array
                const legendData = Array.isArray(legendObj.data) ? [...legendObj.data] : [];

                // Gather all new series names
                const newSeriesNames = updatedSeries
                    .map(s => s.name)
                    .filter(name => !!name && !legendData.includes(name as string));

                const mergedLegendData = legendData.concat(newSeriesNames);
                return {
                    ...legendObj,
                    data: mergedLegendData,
                };
            });
        } else if (existingLegend && !Array.isArray(existingLegend)) {
            // If it's a single legend object
            const legendData = Array.isArray(existingLegend.data)
                ? [...existingLegend.data]
                : [];

            // Gather all new series names
            const newSeriesNames = updatedSeries
                .map(s => s.name)
                .filter(name => !!name && !legendData.includes(name as string));

            const mergedLegendData = legendData.concat(newSeriesNames);
            updatedLegend = [
                {
                    ...existingLegend,
                    data: mergedLegendData,
                },
            ];
        } else {
            // If no legend config exists, create one
            const newSeriesNames = updatedSeries.map(s => s.name).filter(Boolean) as string[];
            updatedLegend = [
                {
                    data: newSeriesNames,
                    left: 'left',
                },
            ];
        }

        attachRenderItem(filteredOptions);

        // Save absolute zoom ranges before applying new options
        // This captures the current view window in absolute coordinates
        saveAbsoluteZoomRanges(chart);

        // Get the old axis ranges
        const oldXAxis = Array.isArray(filteredOptions.xAxis) ? filteredOptions.xAxis[0] : filteredOptions.xAxis;
        const oldYAxis = Array.isArray(filteredOptions.yAxis) ? filteredOptions.yAxis[0] : filteredOptions.yAxis;
        const oldXMin = typeof oldXAxis?.min === 'number' ? oldXAxis.min : 0;
        const oldXMax = typeof oldXAxis?.max === 'number' ? oldXAxis.max : 100;

        // Store the old axis ranges
        atlChartFilterStore.xAxisMin = oldXMin;
        atlChartFilterStore.xAxisMax = oldXMax;

        const oldYMin = typeof oldYAxis?.min === 'number' ? oldYAxis.min : 0;
        const oldYMax = typeof oldYAxis?.max === 'number' ? oldYAxis.max : 100;

        // Calculate the current absolute view ranges based on zoom percentages
        const xView = percentToAbsoluteRange(
            atlChartFilterStore.xZoomStart,
            atlChartFilterStore.xZoomEnd,
            oldXMin,
            oldXMax
        );
        const yView = percentToAbsoluteRange(
            atlChartFilterStore.yZoomStart,
            atlChartFilterStore.yZoomEnd,
            oldYMin,
            oldYMax
        );

        // Store the absolute view ranges
        atlChartFilterStore.xViewMin = xView.min;
        atlChartFilterStore.xViewMax = xView.max;
        atlChartFilterStore.yViewMin = yView.min;
        atlChartFilterStore.yViewMax = yView.max;

        // -----------------------------
        //     APPLY UPDATED OPTIONS
        // -----------------------------
        chart.setOption({
                ...filteredOptions,
                legend: updatedLegend,
                series: updatedSeries,
                yAxis: updatedYAxis,
            }, { notMerge: true }
        );
        const options = chart.getOption() as EChartsOption;
        //console.log(`appendSeries ${reqId} AFTER options:`, options);

        // Get the NEW axis ranges after the update
        const newXAxis = Array.isArray(options.xAxis) ? options.xAxis[0] : options.xAxis;
        const newYAxis = Array.isArray(updatedYAxis) ? updatedYAxis[0] : updatedYAxis;
        const newXMin = typeof newXAxis?.min === 'number' ? newXAxis.min : oldXMin;
        const newXMax = typeof newXAxis?.max === 'number' ? newXAxis.max : oldXMax;
        const newYMin = typeof newYAxis?.min === 'number' ? newYAxis.min : oldYMin;
        const newYMax = typeof newYAxis?.max === 'number' ? newYAxis.max : oldYMax;

        // Only restore zoom if the view ranges were previously set (i.e., user had zoomed)
        // If xViewMin/Max are null, it means no zoom was active, so we can skip restoration
        if (atlChartFilterStore.xViewMin !== null &&
            atlChartFilterStore.xViewMax !== null &&
            atlChartFilterStore.yViewMin !== null &&
            atlChartFilterStore.yViewMax !== null) {
            // Restore zoom based on the absolute view ranges and new axis scales
            restoreZoomFromAbsoluteRanges(newXMin, newXMax, newYMin, newYMax);
        } else {
            // No previous zoom state - initialize the view ranges
            atlChartFilterStore.xViewMin = newXMin;
            atlChartFilterStore.xViewMax = newXMax;
            atlChartFilterStore.yViewMin = newYMin;
            atlChartFilterStore.yViewMax = newYMax;
            atlChartFilterStore.xAxisMin = newXMin;
            atlChartFilterStore.xAxisMax = newXMax;
            atlChartFilterStore.yAxisMin = newYMin;
            atlChartFilterStore.yAxisMax = newYMax;
        }

        // Apply the restored zoom to the chart
        chart.setOption({
            dataZoom: [
                {
                    type: 'slider',
                    xAxisIndex: 0,
                    start: atlChartFilterStore.xZoomStart,
                    end: atlChartFilterStore.xZoomEnd,
                },
                {
                    type: 'slider',
                    yAxisIndex: 0,
                    start: atlChartFilterStore.yZoomStart,
                    end: atlChartFilterStore.yZoomEnd,
                },
                {
                    type: 'inside',
                    xAxisIndex: 0,
                    start: atlChartFilterStore.xZoomStart,
                    end: atlChartFilterStore.xZoomEnd,
                },
                {
                    type: 'inside',
                    yAxisIndex: 0,
                    start: atlChartFilterStore.yZoomStart,
                    end: atlChartFilterStore.yZoomEnd,
                },
            ],
        }, { replaceMerge: ['dataZoom'] });

        //console.log( `appendSeries(${reqIdStr}): Successfully appended scatter series and updated yAxis + legend.`,chart.getOption());
    } catch (error) {
        console.error(`appendSeries(${reqId}): Error appending scatter series.`, error);
    }
}
  
export const addOverlaysToScatterPlot = async (msg:string) => {
    const startTime = performance.now();
    //console.log(`addOverlaysToScatterPlot for: ${msg}`);
    // Retrieve existing options from the chart
    const plotRef = useAtlChartFilterStore().getPlotRef();
    if (plotRef && plotRef.chart) {
        const reqIds = useAtlChartFilterStore().getSelectedOverlayedReqIds();
        //console.log(`addOverlaysToScatterPlot reqIds:`, reqIds);
        reqIds.forEach(async reqId => { 
            if(reqId > 0){
                await updateWhereClauseAndXData(reqId);
                await appendSeries(reqId);
            } else {
                console.error(`addOverlaysToScatterPlot Invalid request ID:${reqId}`);
            }
        });
    } else {
        console.warn(`Ignoring addOverlaysToScatterPlot with no plot to update, plotRef is undefined.`);
    }
    const endTime = performance.now();
    console.log(`addOverlaysToScatterPlot took ${endTime - startTime} milliseconds.`);
}

export const refreshScatterPlot = async (msg:string) => {
    console.log(`refreshScatterPlot ${msg}`);
    const recTreeStore = useRecTreeStore();
    const atlChartFilterStore = useAtlChartFilterStore();
    const plotRef = atlChartFilterStore.getPlotRef();
    if (plotRef){
        if(plotRef.chart) {
            await initScatterPlotWith(recTreeStore.selectedReqId);
            await addOverlaysToScatterPlot(msg);
        } else {
            console.warn(`Ignoring refreshScatterPlot with no chart to refresh, plotRef.chart is undefined.`);
        }
    } else {
        console.warn(`Ignoring refreshScatterPlot with no plot to refresh, plotRef is undefined.`);
    }
};

export async function getPhotonOverlayRunContext(): Promise<SrRunContext> {
    const recTreeStore = useRecTreeStore();
    const atlChartFilterStore = useAtlChartFilterStore();
    const requestsStore = useRequestsStore();
    const globalChartStore = useGlobalChartStore();
    const reqIdStr = recTreeStore.selectedReqIdStr;
    //console.log('getPhotonOverlayRunContext reqIdStr:', reqIdStr, ' chartStore.stateByReqId:', chartStore.stateByReqId[reqIdStr]);
    const runContext: SrRunContext = {
        reqId: -1, // this will be set in the worker
        parentReqId: recTreeStore.selectedReqId,
        trackFilter: {
            rgt: (globalChartStore.getRgt()>=0) ? globalChartStore.getRgt(): -1,
            cycle: (globalChartStore.getCycles().length === 1) ? globalChartStore.getCycles()[0]: -1,
            track: (globalChartStore.getTracks().length === 1) ? globalChartStore.getTracks()[0]: -1,
            beam: (globalChartStore.getGts().length === 1) ? globalChartStore.getGts()[0]: -1,
        }
    };
    if(atlChartFilterStore.getShowPhotonCloud()){
        //console.log('Show Photon Cloud Overlay checked');
        const reqId = await indexedDb.findCachedRec(runContext);
        if(reqId && (reqId > 0)){ // Use the cached request
            runContext.reqId = reqId;
            console.log('findCachedRec reqId found:', reqId, 'runContext:', runContext);
            atlChartFilterStore.setSelectedOverlayedReqIds([reqId]);
        } else {
            console.warn('findCachedRec reqId not found, NEED to fetch for:', runContext);
            requestsStore.setSvrMsg('');
        }
    }
    return runContext;
}


let updatePlotTimeoutId: number | undefined;
let pendingResolves: Array<() => void> = [];
let inFlight = false;
let pendingMessages: string[] = [];   // <── collects all contributors

export async function callPlotUpdateDebounced(msg: string): Promise<void> {
    console.log("callPlotUpdateDebounced -called:", msg);
    const atlChartFilterStore = useAtlChartFilterStore();
    atlChartFilterStore.setIsWarning(true);
    atlChartFilterStore.setMessage('Updating...');

    // Collect every reason
    pendingMessages.push(msg);

    if (updatePlotTimeoutId) {
        clearTimeout(updatePlotTimeoutId);
    }

    return new Promise((resolve) => {
        pendingResolves.push(resolve);

        updatePlotTimeoutId = window.setTimeout(async () => {
            updatePlotTimeoutId = undefined;
            try {
                // collapse messages into a single combined string
                const combinedMsg = pendingMessages.join(" | ");
                pendingMessages = []; // reset for next cycle

                while (inFlight) {
                    await new Promise(r => setTimeout(r, 10));
                }
                inFlight = true;

                await updatePlotAndSelectedTrackMapLayer(combinedMsg);
            } catch (err) {
                console.error('Plot update failed:', err);
            } finally {
                inFlight = false;
                try {
                    atlChartFilterStore.setIsWarning(false);
                    atlChartFilterStore.setMessage('');
                } catch {}
                pendingResolves.forEach(res => res());
                pendingResolves = [];
            }
        }, 500);
    });
}

async function updatePlotAndSelectedTrackMapLayer(msg: string): Promise<void> {
    const startTime = performance.now(); 
    console.log('updatePlotAndSelectedTrackMapLayer --called:', msg);

    const globalChartStore = useGlobalChartStore();
    const recTreeStore = useRecTreeStore();
    const activeTabStore = useActiveTabStore();

    const hasRgtOk =
        (!globalChartStore.use_rgt_in_filter) ||
        (globalChartStore.use_rgt_in_filter && globalChartStore.getRgt() >= 0);

    const hasCycles = globalChartStore.getCycles().length > 0;
    const hasSpots  = globalChartStore.getSpots().length  > 0;

    if (!(hasRgtOk && hasCycles && hasSpots)) {
        console.warn('updatePlotAndSelectedTrackMapLayer Need Rgts, Cycles, and Spots values selected');
        console.warn('Rgt:', globalChartStore.getRgt());
        console.warn('Cycles:', globalChartStore.getCycles());
        console.warn('Spots:', globalChartStore.getSpots());
        return;
    }

    const selectedApi   = recTreeStore.selectedApi;
    const selectedReqId = recTreeStore.selectedReqId;

    let hasSelectedMapLayer = true;

    if (activeTabStore.isActiveTabTimeSeries) {
        checkAndSetFilterForTimeSeries();
        if (selectedApi === 'atl13x') hasSelectedMapLayer = false;
    } else if (activeTabStore.isActiveTab3D) {
        checkAndSetFilterFor3D();
        if (selectedApi === 'atl13x') hasSelectedMapLayer = false;
    }
    // Always read this: because of the async debounce, the selectedReqId may have changed since this was called
    await duckDbReadAndUpdateSelectedLayer(selectedReqId, SELECTED_LAYER_NAME_PREFIX);
    if (!hasSelectedMapLayer) {
        useDeckStore().deleteSelectedLayer();
    }
    await refreshScatterPlot(msg);

    const endTime = performance.now();
    console.log(`updatePlotAndSelectedTrackMapLayer took ${endTime - startTime} ms.`);
}


export const findReqMenuLabel = (reqId:number) => {
    const recTreeStore = useRecTreeStore();
    const item = recTreeStore.reqIdMenuItems.find(
        (i) => i.value === reqId
    )
    return item ? item.label : 'unknown'
}

export async function initSymbolSize(req_id: number):Promise<number>{
    const reqIdStr = req_id.toString();
    const plotConfig = await indexedDb.getPlotConfig();
    const symbolStore = useSymbolStore(); 
    const func = await indexedDb.getFunc(req_id);//must use db
    if ((func ==='atl03sp') || (func === 'atl03x') || (func === 'atl03vp') ){
        //symbolStore.size[reqIdStr] = (plotConfig?.defaultAtl03spSymbolSize  ?? 1);
        symbolStore.setSize(reqIdStr, (plotConfig?.defaultAtl03spSymbolSize  ?? 1));
    } else if (func.includes('atl03vp')) {
        //symbolStore.size[reqIdStr] = (plotConfig?.defaultAtl03vpSymbolSize  ?? 5);
        symbolStore.setSize(reqIdStr, (plotConfig?.defaultAtl03vpSymbolSize  ?? 5));
    } else {
        symbolStore.setSize(reqIdStr, (plotConfig?.defaultAtl06SymbolSize ?? 3));
    } 
    //console.log('initSymbolSize reqId:', req_id, 'func:', func, 'symbolSize:', chartStore.getSymbolSize(reqIdStr));
    return symbolStore.getSize(reqIdStr); 
}

export async function updateWhereClauseAndXData(req_id: number) {
    //console.log('updateWhereClauseAndXData req_id:', req_id);
    if (req_id <= 0) {
        console.warn(`updateWhereClauseAndXData Invalid request ID:${req_id}`);
        return;
    }
    try {
        const reqIdStr = req_id.toString();
        //console.log('updateWhereClauseAndXData req_id:', req_id);
        const func = useRecTreeStore().findApiForReqId(req_id);
        const chartStore = useChartStore();
        chartStore.setXDataForChartUsingFunc(reqIdStr, func);
        
        const whereClause = createWhereClause(req_id);
        if(whereClause !== ''){
            chartStore.setWhereClause(reqIdStr,whereClause);
        } else {
            console.error('updateWhereClauseAndXData whereClause is empty');
        }
    } catch (error) {
        console.warn('updateWhereClauseAndXData Failed to update selected request:', error);
    }
}
export async function checkAndSetFilterForTimeSeries() {
    //console.log('checkAndSetFilterForTimeSeries called');
    const globalChartStore = useGlobalChartStore();
    const chartStore = useChartStore();
    const reqIdStr = useRecTreeStore().selectedReqIdStr;
    chartStore.setUseSelectedMinMax(reqIdStr, false);
    chartStore.setSelectedColorEncodeData(reqIdStr, 'cycle');
    if(useRecTreeStore().selectedApi === 'atl13x'){
        globalChartStore.set_use_y_atc_filter(false);
        globalChartStore.setSpots([1,2,3,4,5,6]);
        globalChartStore.setScOrients([SC_BACKWARD, SC_FORWARD]);
        await globalChartStore.selectAllCycleOptions();
        globalChartStore.use_rgt_in_filter = false;
        //console.log('checkAndSetFilterForTimeSeries Setting use_y_atc_filter false, Spots to [1,2,3,4,5,6], Cycles to:',globalChartStore.getSelectedCycleOptions(),'/', globalChartStore.getCycles());
    } else {
        globalChartStore.use_rgt_in_filter = true;
        await resetFilterUsingSelectedRec();
    }
}

export async function checkAndSetFilterFor3D() {
    console.log('checkAndSetFilterFor3D called');
    const globalChartStore = useGlobalChartStore();
    const recTreeStore = useRecTreeStore();
    const chartStore = useChartStore();
    const deck3DConfigStore = useDeck3DConfigStore();

    if(useActiveTabStore().isActiveTab3D){
        useChartStore().setUseSelectedMinMax(useRecTreeStore().selectedReqIdStr, false);
        if(useRecTreeStore().selectedApi === 'atl13x'){
            // verticalExaggeration will be set automatically based on data in renderCachedData
            globalChartStore.set_use_y_atc_filter(false);
            globalChartStore.setSpots([1,2,3,4,5,6]);
            globalChartStore.setScOrients([SC_BACKWARD, SC_FORWARD]);
            await globalChartStore.selectAllCycleOptions();
            globalChartStore.use_rgt_in_filter = false;
            chartStore.setSelectedColorEncodeData(recTreeStore.selectedReqIdStr, 'cycle');
            //console.log('checkAndSetFilterForTimeSeries Setting use_y_atc_filter false, Spots to [1,2,3,4,5,6], Cycles to all');
        } else {
            // verticalExaggeration will be set automatically based on data in renderCachedData
            chartStore.setSelectedColorEncodeData(recTreeStore.selectedReqIdStr, getDefaultColorEncoding(recTreeStore.selectedReqId));
            await resetFilterUsingSelectedRec();
            globalChartStore.use_rgt_in_filter = true;
        }
    }
}