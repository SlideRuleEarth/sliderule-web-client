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

// Helper to compute UTM proj string
function getUtmProjString(lat: number, lon: number): string {
    const zone = Math.floor((lon + 180) / 6) + 1;
    const hemisphere = lat >= 0 ? 'north' : 'south';
    return `+proj=utm +zone=${zone} +${hemisphere} +datum=WGS84 +units=m +no_defs`;
}

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
    lonMax: number,
    verticalExaggeration: number = 1
): Layer<any>[] {
    const origin: [number, number, number] = [0, 0, 0];
    const projFrom = 'EPSG:4326';
    const projTo = getUtmProjString(latMin, lonMin);

    const [xOrigin, yOrigin] = proj4(projFrom, projTo, [lonMin, latMin]);
    const [xMax, _yIgnore] = proj4(projFrom, projTo, [lonMax, latMin]);
    const [_xIgnore, yMax] = proj4(projFrom, projTo, [lonMin, latMax]);
    const xRange = xMax - xOrigin;
    const yRange = yMax - yOrigin;

    const tickInterval = scale / 10;
    const tickLength = scale * 0.04;

    const ticks: TickLine[] = [];
    const tickLabels: TickLabel[] = [];

    const xTicks = [scale / 2, scale];
    const yTicks = [scale / 2, scale];

    xTicks.forEach(i => {
        const xMeter = (i / scale) * xRange;
        ticks.push({ source: [i, -tickLength, 0], target: [i, tickLength, 0], color: axisLineColor });
        tickLabels.push({
            position: [i, -2 * tickLength, 0],
            text: `${xMeter.toFixed(0)} m`,
            color: labelTextColor
        });
    });

    yTicks.forEach(i => {
        const yMeter = (i / scale) * yRange;
        ticks.push({ source: [-tickLength, i, 0], target: [tickLength, i, 0], color: axisLineColor });
        tickLabels.push({
            position: [-2 * tickLength, i, 0],
            text: `${yMeter.toFixed(0)} m`,
            color: labelTextColor
        });
    });

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

    const xylabelOffset = scale * 0.10;
    const zlabelOffset = scale * 0.07;

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
