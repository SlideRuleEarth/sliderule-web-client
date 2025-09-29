// Instance type (what vue-echarts returns via getEchartsInstance)
export type { EChartsType as ECharts } from 'echarts/core';

// Option + series types (top-level 'echarts' is safest here)
export type { EChartsOption, SeriesOption } from 'echarts';
export type { ScatterSeriesOption } from 'echarts/charts';

// Derived shapes from EChartsOption (avoid component export name drift)
export type YAxisLike =
  NonNullable<EChartsOption['yAxis']> extends any[]
    ? NonNullable<EChartsOption['yAxis']>[number]
    : NonNullable<EChartsOption['yAxis']>;

export type XAxisLike =
  NonNullable<EChartsOption['xAxis']> extends any[]
    ? NonNullable<EChartsOption['xAxis']>[number]
    : NonNullable<EChartsOption['xAxis']>;

export type LegendLike =
  NonNullable<EChartsOption['legend']> extends any[]
    ? NonNullable<EChartsOption['legend']>[number]
    : NonNullable<EChartsOption['legend']>;

export type ECOption = EChartsOption;
