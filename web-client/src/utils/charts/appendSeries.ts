// appendSeries.ts
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useChartStore } from '@/stores/chartStore';
import { attachRenderItem, getSeriesFor } from '@/utils/plotUtils';

import type { ECharts, ECOption, SeriesOption } from '@/types/echarts';

import { normalizeOptions } from '@/utils/charts/helpers/optionHelpers';
import { ensureHeightAxis, mapSeriesToAxes, type SeriesWithStats } from '@/utils/charts/helpers/axisHelpers';
import { mergeLegend } from '@/utils/charts/helpers/legendHelpers';
import { HEIGHT_FIELDS } from '@/utils/charts/helpers/constants';
import { createWhereClause } from '@/utils/spotUtils';

function removeUnusedOptions(options: ECOption): ECOption {
  if (!options) return {} as ECOption;
  const clone = { ...options } as any;
  delete clone.visualMap;
  delete clone.timeline;
  delete clone.calendar;
  return clone as ECOption;
}

export async function appendSeries(reqId: number): Promise<void> {
  const reqIdStr = String(reqId);

  const chart = useAtlChartFilterStore().getChart();   // ✅ use the new getter
  if (!chart) {
    console.warn(`appendSeries(${reqIdStr}): chart is undefined.`);
    return;
  }

  const existing = chart.getOption() as ECOption;
  const baseOptions = removeUnusedOptions(existing);
  const { yAxisArr, seriesArr } = normalizeOptions(baseOptions);

  const data = (await getSeriesFor(reqIdStr, true)) as SeriesWithStats[];
  if (!Array.isArray(data) || data.length === 0) {
    console.warn(`appendSeries(${reqIdStr}): No series data found.`);
    return;
  }

  const isHeight = (n?: string) => !!n && (HEIGHT_FIELDS as readonly string[]).includes(n);
  const heightSeries = data.filter(d => isHeight(d.series?.name));
  const nonHeightSeries = data.filter(d => !isHeight(d.series?.name));

  const { index: heightAxisIndex, yAxes: yAxesAfterHeight } = ensureHeightAxis([...yAxisArr], heightSeries);
  const { appended, yAxes: finalYAxes } = mapSeriesToAxes(heightAxisIndex, yAxesAfterHeight, heightSeries, nonHeightSeries, reqIdStr);

  const nextSeries: SeriesOption[] = [...seriesArr, ...(appended as unknown as SeriesOption[])];
  const updatedLegend = mergeLegend(baseOptions.legend, nextSeries);

  attachRenderItem(baseOptions);

  chart.setOption(
    {
      ...baseOptions,
      legend: updatedLegend,
      yAxis: finalYAxes,
      series: nextSeries
    } as ECOption,
    { notMerge: false, replaceMerge: ['series','yAxis','legend'] }
  );

  console.log(`appendSeries(${reqIdStr}): appended ${appended.length} series; yAxes now ${finalYAxes.length}.`);
}
export async function updateWhereClauseAndXData(req_id: number) {
  if (req_id <= 0) {
    console.warn(`updateWhereClauseAndXData Invalid request ID:${req_id}`);
    return;
  }
  try {
    const reqIdStr = String(req_id);
    const func = useRecTreeStore().findApiForReqId(req_id);
    const chartStore = useChartStore();

    chartStore.setXDataForChartUsingFunc(reqIdStr, func);

    const whereClause = createWhereClause(req_id);
    if (whereClause !== '') {
      chartStore.setWhereClause(reqIdStr, whereClause);
    } else {
      console.warn('updateWhereClauseAndXData whereClause is empty');
    }
  } catch (error) {
    console.warn('updateWhereClauseAndXData Failed to update selected request:', error);
  }
}

export const addOverlaysToScatterPlot = async (msg: string) => {
  const startTime = performance.now();
  const store = useAtlChartFilterStore();

  // Only proceed if a chart instance exists
  if (store.getChart()) {
    const reqIds = store.getSelectedOverlayedReqIds();

    for (const reqId of reqIds) {
      if (reqId > 0) {
        await updateWhereClauseAndXData(reqId);
        await appendSeries(reqId);
      } else {
        console.error(`addOverlaysToScatterPlot Invalid request ID:${reqId}`);
      }
    }
  } else {
    console.warn(`Ignoring addOverlaysToScatterPlot (${msg}) — no chart instance yet.`);
  }

  const endTime = performance.now();
  console.log(`addOverlaysToScatterPlot took ${Math.round(endTime - startTime)} ms.`);
};
