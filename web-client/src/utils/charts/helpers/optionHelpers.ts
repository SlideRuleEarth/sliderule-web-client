// optionHelpers.ts
import type { ECOption, SeriesOption, YAxisLike } from '@/types/echarts';

export function normalizeOptions(opts: ECOption) {
  const yAxisArr: YAxisLike[] = Array.isArray(opts.yAxis)
    ? [...(opts.yAxis as YAxisLike[])]
    : (opts.yAxis ? [opts.yAxis as YAxisLike] : []);

  const seriesArr: SeriesOption[] = Array.isArray(opts.series)
    ? [...(opts.series as SeriesOption[])]
    : (opts.series ? [opts.series as SeriesOption] : []);

  return { yAxisArr, seriesArr };
}
