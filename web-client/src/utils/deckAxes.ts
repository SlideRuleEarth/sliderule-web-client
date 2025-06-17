import { LineLayer, TextLayer } from '@deck.gl/layers';
import { COORDINATE_SYSTEM, type Layer } from '@deck.gl/core';

export function createAxesAndLabels(
    scale: number,
    xLabel: string = 'X',
    yLabel: string = 'Y',
    zLabel: string = 'Z',
    labelTextColor: [number, number, number] = [255, 255, 255],
    axisLineColor: [number, number, number] = [255, 255, 255],
    fontSize: number = 5,
    lineWidth: number = 1,
    elevMin: number,
    elevMax: number
): Layer<any>[] {
    const origin: [number, number, number] = [0, 0, 0];
    const tickInterval = scale / 10;
    const tickLength = scale * 0.01; // short lines for ticks

    const ticks: { source: [number, number, number]; target: [number, number, number]; color: [number, number, number] }[] = [];
    const tickLabels: { position: [number, number, number]; text: string; color: [number, number, number] }[] = [];

    // Generate ticks and labels for each axis
    for (let i = tickInterval; i < scale; i += tickInterval) {
        // X-axis
        ticks.push({ source: [i, -tickLength, 0], target: [i, tickLength, 0], color: axisLineColor });
        tickLabels.push({ position: [i, -2 * tickLength, 0], text: i.toFixed(1), color: labelTextColor });

        // Y-axis
        ticks.push({ source: [-tickLength, i, 0], target: [tickLength, i, 0], color: axisLineColor });
        tickLabels.push({ position: [-2 * tickLength, i, 0], text: i.toFixed(1), color: labelTextColor });

        // Z-axis
        ticks.push({ source: [0, -tickLength, i], target: [0, tickLength, i], color: axisLineColor });

        let zLabel = i.toFixed(1); // fallback
        if (elevMin !== undefined && elevMax !== undefined) {
            const realZ = elevMin + (i / scale) * (elevMax - elevMin);
            zLabel = realZ.toFixed(0); // use real units in meters
        }

        tickLabels.push({ position: [0, -2 * tickLength, i], text: zLabel, color: labelTextColor });
    }

    const axes = new LineLayer({
        id: 'axis-lines',
        data: [
            { source: origin, target: [scale, 0, 0], color: axisLineColor },
            { source: origin, target: [0, scale, 0], color: axisLineColor },
            { source: origin, target: [0, 0, scale], color: axisLineColor }
        ],
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getColor: d => d.color,
        getWidth: lineWidth,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        pickable: false,
        updateTriggers: {
            getSourcePosition: [scale],
            getTargetPosition: [scale],
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

    const labels = new TextLayer({
        id: 'axis-labels',
        data: [
            { position: [scale, 0, 0], text: xLabel, color: labelTextColor },
            { position: [0, scale, 0], text: yLabel, color: labelTextColor },
            { position: [0, 0, scale], text: zLabel, color: labelTextColor }
        ],
        getPosition: d => d.position,
        getText: d => d.text,
        getColor: d => d.color,
        getSize: fontSize,
        sizeUnits: 'meters',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        billboard: true,
        updateTriggers: {
            getPosition: [scale],
            getText: [xLabel, yLabel, zLabel],
            getColor: [labelTextColor],
            getSize: [fontSize]
        }
    });

    return [axes, labels, tickLines, tickText];
}
