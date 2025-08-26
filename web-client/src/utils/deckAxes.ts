import { LineLayer, TextLayer } from '@deck.gl/layers';
import { COORDINATE_SYSTEM, type Layer } from '@deck.gl/core';

type TickLine = {
    source: [number, number, number];
    target: [number, number, number];
    color: [number, number, number];
};

type TickLabel = {
    position: [number, number, number];
    text: string;
    color: [number, number, number];
};

/**
 * Scales per axis (world units) + meter extents for XY.
 * xMinMeters/xMaxMeters are Emin/Emax; yMinMeters/yMaxMeters are Nmin/Nmax.
 */
export function createAxesAndLabels(
    scaleX: number,
    scaleY: number,
    scaleZ: number,
    xLabel: string = 'X',
    yLabel: string = 'Y',
    zLabel: string = 'Z',
    labelTextColor: [number, number, number] = [255, 255, 255],
    axisLineColor: [number, number, number] = [255, 255, 255],
    fontSize: number = 5,
    lineWidth: number = 1,
    elevMin: number,
    elevMax: number,
    yMinMeters: number,
    yMaxMeters: number,
    xMinMeters: number,
    xMaxMeters: number
): Layer<any>[] {
    const xRangeMeters = xMaxMeters - xMinMeters;
    const yRangeMeters = yMaxMeters - yMinMeters;

    const origin: [number, number, number] = [0, 0, 0];

    // Consistent visual sizes based on the longest axis
    const axisMax = Math.max(scaleX, scaleY, scaleZ);
    const tickIntervalZ = scaleZ / 10;
    const tickLength = axisMax * 0.04;

    const ticks: TickLine[] = [];
    const tickLabels: TickLabel[] = [];

    // X ticks at mid and end
    const xTicks = [scaleX / 2, scaleX];
    xTicks.forEach(i => {
        const xMeters = (i / scaleX) * xRangeMeters;
        ticks.push({ source: [i, -tickLength, 0], target: [i, tickLength, 0], color: axisLineColor });
        tickLabels.push({ position: [i, -2 * tickLength, 0], text: `${xMeters.toFixed(0)} m`, color: labelTextColor });
    });

    // Y ticks at mid and end
    const yTicks = [scaleY / 2, scaleY];
    yTicks.forEach(i => {
        const yMeters = (i / scaleY) * yRangeMeters;
        ticks.push({ source: [-tickLength, i, 0], target: [tickLength, i, 0], color: axisLineColor });
        tickLabels.push({ position: [-2 * tickLength, i, 0], text: `${yMeters.toFixed(0)} m`, color: labelTextColor });
    });

    // Z ticks (linear inversion of your z mapping; verticalScaleRatio is 1)
    const zRangeMeters = Math.max(1e-6, elevMax - elevMin);
    if (scaleZ > 1e-9) {
        for (let i = tickIntervalZ; i < scaleZ; i += tickIntervalZ) {
            ticks.push({ source: [0, -tickLength, i], target: [0, tickLength, i], color: axisLineColor });

            const realZ = elevMin + (i / scaleZ) * zRangeMeters;
            tickLabels.push({ position: [0, -2 * tickLength, i], text: `${realZ.toFixed(0)} m`, color: labelTextColor });
        }
    }

    // Axis lines
    const axes = new LineLayer({
        id: 'axis-lines',
        data: [
            { source: origin, target: [scaleX, 0, 0], color: axisLineColor }, // X
            { source: origin, target: [0, scaleY, 0], color: axisLineColor }, // Y
            { source: origin, target: [0, 0, scaleZ], color: axisLineColor }  // Z
        ],
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getColor: d => d.color,
        getWidth: lineWidth,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        pickable: false,
        updateTriggers: {
            getSourcePosition: [scaleX, scaleY, scaleZ],
            getTargetPosition: [scaleX, scaleY, scaleZ],
            getColor: [axisLineColor],
            getWidth: [lineWidth]
        }
    });

    const tickLines = new LineLayer({
        id: 'axis-tick-lines',
        data: ticks,
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getColor: d => d.color,
        getWidth: lineWidth,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        pickable: false
    });

    const tickText = new TextLayer({
        id: 'axis-tick-labels',
        data: tickLabels,
        getPosition: d => d.position,
        getText: d => d.text,
        getColor: d => d.color,
        getSize: fontSize * 0.8,
        sizeUnits: 'meters',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        billboard: true
    });

    // Axis labels (offsets relative to longest axis)
    const xylabelOffset = axisMax * 0.10;
    const zlabelOffset = axisMax * 0.07;

    const labels = new TextLayer({
        id: 'axis-labels',
        data: [
            { position: [scaleX + xylabelOffset, 0, 0], text: xLabel, color: labelTextColor },
            { position: [0, scaleY + xylabelOffset, 0], text: yLabel, color: labelTextColor },
            { position: [0, 0, scaleZ + zlabelOffset], text: zLabel, color: labelTextColor }
        ],
        getPosition: d => d.position,
        getText: d => d.text,
        getColor: d => d.color,
        getSize: fontSize,
        sizeUnits: 'meters',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        billboard: true
    });

    return [axes, labels, tickLines, tickText];
}
