// legendHelpers.ts
import type { ECOption, LegendLike, SeriesOption } from '@/types/echarts';

// Legend element with an optional `data` array (what we actually use)
type LegendWithData = LegendLike & { data?: unknown };

function toLegendArray(legend: ECOption['legend']): LegendLike[] {
    if (!legend) return [];
    return Array.isArray(legend) ? (legend as LegendLike[]) : [legend as LegendLike];
}

export function mergeLegend(
    existingLegend: ECOption['legend'],
    series: SeriesOption[]
): LegendLike[] {
    const newNames = Array.from(new Set(series.map(s => s.name).filter(Boolean))) as string[];

    // Narrow to array, then locally narrow each item to LegendWithData
    const legends = toLegendArray(existingLegend) as LegendWithData[];

    if (legends.length) {
        return legends.map((lg) => {
            const base = Array.isArray(lg.data) ? (lg.data as string[]) : [];
            const merged = Array.from(new Set([...base, ...newNames]));
            // write back; keep the rest of lg intact
            return { ...lg, data: merged } as LegendLike;
        });
    }

    // No legend present → create one
    return [{ data: newNames, left: 'left' } as LegendLike];
}
