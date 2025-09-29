// axisHelpers.ts
import { HEIGHT_FIELDS } from './constants';
import type { ScatterSeriesOption, YAxisLike } from '@/types/echarts';

export type SeriesWithStats = {
    series: Partial<ScatterSeriesOption> & { name?: string; id?: string };
    min?: number | null;
    max?: number | null;
};

// Minimal shape for the axes we *create*
type ValueYAxis = {
    type: 'value';
    name?: string;
    position?: 'left' | 'right';
    offset?: number;
    scale?: boolean;
    min?: number;
    max?: number;
    axisLabel?: { formatter?: (v: number) => string };
};

export function isFiniteNumber(v: unknown): v is number {
    return typeof v === 'number' && Number.isFinite(v);
}

function coalesceFinite(
    a: number | null | undefined,
    b: number | null | undefined
): { lo?: number; hi?: number } {
    const aOk = isFiniteNumber(a);
    const bOk = isFiniteNumber(b);
    if (aOk && bOk) return { lo: Math.min(a as number, b as number), hi: Math.max(a as number, b as number) };
    if (aOk) return { lo: a as number, hi: a as number };
    if (bOk) return { lo: b as number, hi: b as number };
    return {};
}

/**
 * Add a y-axis alternating left/right with growing offset to avoid overlap.
 * Returns the index of the new axis.
 */
export function addYAxisWithLayout(base: Partial<ValueYAxis>, yAxes: YAxisLike[]): number {
    const leftCount  = yAxes.filter(a => (a as any).position !== 'right').length;
    const rightCount = yAxes.filter(a => (a as any).position === 'right').length;
    const position: 'left' | 'right' = leftCount <= rightCount ? 'left' : 'right';
    const countOnSide = yAxes.filter(a => ((a as any).position ?? 'left') === position).length;

    const axis: ValueYAxis = {
        type: 'value',
        position,
        offset: 48 * countOnSide,
        scale: true,
        axisLabel: { formatter: (v: number) => (isFiniteNumber(v) ? v.toFixed(1) : String(v)) },
        ...base,
    };

    yAxes.push(axis as unknown as YAxisLike);
    return yAxes.length - 1;
}

/**
 * Ensure a shared "height" axis exists (or expand an existing one).
 * Returns its index and the updated y-axes array.
 */
export function ensureHeightAxis(
    yAxes: YAxisLike[],
    heightSeries: SeriesWithStats[]
): { index: number; yAxes: YAxisLike[] } {
    if (heightSeries.length === 0) return { index: -1, yAxes };

    let hMin = Number.POSITIVE_INFINITY;
    let hMax = Number.NEGATIVE_INFINITY;
    const newNames: string[] = [];

    for (const d of heightSeries) {
        if (isFiniteNumber(d.min) && d.min! < hMin) hMin = d.min!;
        if (isFiniteNumber(d.max) && d.max! > hMax) hMax = d.max!;
        if (d.series?.name) newNames.push(d.series.name);
    }

    // find existing height axis by name overlap
    let foundIndex = -1;
    let existingNames: string[] = [];
    let existingMin: number | null = null;
    let existingMax: number | null = null;

    for (let i = 0; i < yAxes.length; i++) {
        const a = yAxes[i] as any; // read union safely
        const nm = (a?.name ?? '').toString();
        if (!nm) continue;
        const parts = nm.split(',').map((s: string) => s.trim()).filter(Boolean);
        const intersects = parts.some((p: string) => (HEIGHT_FIELDS as readonly string[]).includes(p));
        if (intersects) {
            foundIndex = i;
            existingNames = parts;
            existingMin = (typeof a.min === 'number') ? a.min : null;
            existingMax = (typeof a.max === 'number') ? a.max : null;
            break;
        }
    }

    const mergedNames = Array.from(new Set([...(existingNames ?? []), ...newNames]));

    const { lo: mergedLo } = coalesceFinite(existingMin, hMin);
    const { hi: mergedHi } = coalesceFinite(existingMax, hMax);
    const finalMin = isFiniteNumber(mergedLo) ? mergedLo : (isFiniteNumber(hMin) ? hMin : undefined);
    const finalMax = isFiniteNumber(mergedHi) ? mergedHi : (isFiniteNumber(hMax) ? hMax : undefined);

    if (foundIndex >= 0) {
        const cur = yAxes[foundIndex] as any;
        yAxes[foundIndex] = {
            ...cur,
            name: mergedNames.join(', '),
            min: finalMin,
            max: finalMax
        } as unknown as YAxisLike;
        return { index: foundIndex, yAxes };
    }

    // create a new shared height axis
    const newIndex = addYAxisWithLayout(
        {
            name: mergedNames.join(', ') || (HEIGHT_FIELDS as readonly string[]).join(', '),
            min: finalMin,
            max: finalMax
        },
        yAxes
    );
    return { index: newIndex, yAxes };
}

/**
 * Map height-series to the shared axis and give each non-height series its own axis.
 */
export function mapSeriesToAxes(
    heightAxisIndex: number,
    yAxes: YAxisLike[],
    heightSeries: SeriesWithStats[],
    nonHeightSeries: SeriesWithStats[],
    reqIdStr: string
): { appended: ScatterSeriesOption[]; yAxes: YAxisLike[] } {
    const appended: ScatterSeriesOption[] = [];

    // Height series share one axis
    if (heightSeries.length && heightAxisIndex >= 0) {
        for (const d of heightSeries) {
            const base = d.series;
            appended.push({
                ...base,
                id: base.id ?? `${base.name ?? 'height'}__${reqIdStr}`,
                name: base.name,
                type: 'scatter',
                yAxisIndex: heightAxisIndex
            } as ScatterSeriesOption);
        }
    }

    // Each non-height series gets its own axis
    for (const d of nonHeightSeries) {
        const axisIndex = addYAxisWithLayout(
            {
                name: d.series?.name ?? 'value',
                min: isFiniteNumber(d.min) ? d.min! : undefined,
                max: isFiniteNumber(d.max) ? d.max! : undefined
            },
            yAxes
        );

        const base = d.series;
        appended.push({
            ...base,
            id: base.id ?? `${base.name ?? 'series'}__${reqIdStr}`,
            name: base.name,
            type: 'scatter',
            yAxisIndex: axisIndex
        } as ScatterSeriesOption);
    }

    return { appended, yAxes };
}
