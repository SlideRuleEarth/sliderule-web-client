import { LineLayer, TextLayer } from '@deck.gl/layers';
import { COORDINATE_SYSTEM, type Layer } from '@deck.gl/core';
import proj4 from 'proj4';

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
    elevMax: number,
    latMin: number,
    latMax: number,
    lonMin: number,
    lonMax: number
): Layer<any>[] {
    const origin: [number, number, number] = [0, 0, 0];
    const projFrom = 'EPSG:4326';
    const projTo = 'EPSG:3857';

    const [xOrigin, yOrigin] = proj4(projFrom, projTo, [lonMin, latMin]); // origin = bottom-left
    const [xMax, _yIgnore] = proj4(projFrom, projTo, [lonMax, latMin]); // eastward
    const [_xIgnore, yMax] = proj4(projFrom, projTo, [lonMin, latMax]); // northward
    const xRange = xMax - xOrigin; // meters east
    const yRange = yMax - yOrigin; // meters north

    const tickInterval = scale / 10;
    const tickLength = scale * 0.01; // short lines for ticks

    const ticks: TickLine[] = [];
    const tickLabels: TickLabel[] = [];

    // Generate ticks and labels for each axis
    const xTicks = [scale / 2, scale];
    const yTicks = [scale / 2, scale];


    // X ticks (longitude axis in meters)
    xTicks.forEach(i => {
        const xMeter = (i / scale) * xRange;
        ticks.push({ source: [i, -tickLength, 0], target: [i, tickLength, 0], color: axisLineColor });
        tickLabels.push({
            position: [i, -2 * tickLength, 0],
            text: `${xMeter.toFixed(0)} m`,
            color: labelTextColor
        });
    });


    // Y ticks (latitude axis in meters)
    yTicks.forEach(i => {
        const yMeter = (i / scale) * yRange;
        ticks.push({ source: [-tickLength, i, 0], target: [tickLength, i, 0], color: axisLineColor });
        tickLabels.push({
            position: [-2 * tickLength, i, 0],
            text: `${yMeter.toFixed(0)} m`,
            color: labelTextColor
        });
    });


    // Keep regular ticks for Z-axis
    for (let i = tickInterval; i < scale; i += tickInterval) {
        ticks.push({ source: [0, -tickLength, i], target: [0, tickLength, i], color: axisLineColor });

        let zTickLabel = i.toFixed(1);
        if (elevMin !== undefined && elevMax !== undefined) {
            const realZ = elevMin + (i / scale) * (elevMax - elevMin);
            zTickLabel = realZ.toFixed(0);
        }
        tickLabels.push({ position: [0, -2 * tickLength, i], text: zTickLabel, color: labelTextColor });
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

    const xylabelOffset = scale * 0.10; // 10% of the scale outward
    const zlabelOffset = scale * 0.07; // 7% of the scale outward

    const labels = new TextLayer({
        id: 'axis-labels',
        data: [
            { position: [scale + xylabelOffset, 0, 0], text: xLabel, color: labelTextColor },
            { position: [0, scale + xylabelOffset, 0], text: yLabel, color: labelTextColor },
            { position: [0, 0, scale + zlabelOffset], text: zLabel, color: labelTextColor }
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
    });


    return [axes, labels, tickLines, tickText];
}
