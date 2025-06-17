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
    lineWidth: number = 1
): Layer<any>[] {
    const origin: [number, number, number] = [0, 0, 0];

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

    return [axes, labels];
}
