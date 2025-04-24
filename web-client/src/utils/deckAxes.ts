import { LineLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';

export function createAxesAndLabels(scale: number, xLabel:string='X', yLabel:string='Y', zLabel:string='Z', labelColor:[number,number,number]=[255, 255, 255],lineColor:[number,number,number]=[255, 255, 255]): Layer<any>[] {
    const origin: [number, number, number] = [0, 0, 0];

    const axes = new LineLayer({
        id: 'axis-lines',
        data: [
            { source: origin, target: [scale, 0, 0], color: labelColor }, // X - Red
            { source: origin, target: [0, scale, 0], color: labelColor }, // Y - Green
            { source: origin, target: [0, 0, scale], color: labelColor }  // Z - Blue
        ],
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getColor: d => d.color,
        getWidth: 1,
        coordinateSystem: 1,
        pickable: false
    });

    const labels = new TextLayer({
        id: 'axis-labels',
        data: [
            { position: [scale, 0, 0], text: xLabel, color: lineColor },
            { position: [0, scale, 0], text: yLabel, color: lineColor },
            { position: [0, 0, scale], text: zLabel, color: lineColor }
        ],
        getPosition: d => d.position,
        getText: d => d.text,
        getColor: d => d.color,
        getSize: 5,
        sizeUnits: 'meters',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        coordinateSystem: 1
    });

    return [axes, labels];
}
