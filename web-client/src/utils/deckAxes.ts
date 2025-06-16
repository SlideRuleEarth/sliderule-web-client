import { LineLayer, TextLayer } from '@deck.gl/layers';
import { COORDINATE_SYSTEM } from '@deck.gl/core';

export type AxisUnits = 'degrees' | 'meters';

/**
 * Create 3D axes as LineLayers with optional tick marks and labels.
 * @param origin [x, y, z] - usually the centroid of the point cloud
 * @param length Total length of each axis
 * @param units 'degrees' or 'meters' - affects coordinate system
 * @param tickInterval Distance between major tick marks
 * @param labelOffset Distance beyond axis end to place label
 */
export function createAxesLayers(
    origin: [number, number, number],
    length: number = 1000,
    units: AxisUnits = 'meters',
    tickInterval: number = 200,
    labelOffset: number = 100
) {
    const coordinateSystem = units === 'degrees'
        ? COORDINATE_SYSTEM.LNGLAT
        : COORDINATE_SYSTEM.METER_OFFSETS;

    const unitLabel = units === 'degrees' ? '°' : 'm';

    const getTarget = (axis: 'x' | 'y' | 'z', delta: number): [number, number, number] => {
        const [x, y, z] = origin;
        switch (axis) {
            case 'x': return [x + delta, y, z];
            case 'y': return [x, y + delta, z];
            case 'z': return [x, y, z + delta];
        }
    };

    const axes: any[] = [];

    ['x', 'y', 'z'].forEach((axis, idx) => {
        const axisColor: [number, number, number] =
            idx === 0 ? [255, 0, 0] : idx === 1 ? [0, 255, 0] : [0, 0, 255];

        const axisId = `axis-${axis}`;
        const target = getTarget(axis as 'x' | 'y' | 'z', length);

        axes.push(new LineLayer({
            id: axisId,
            data: [{ sourcePosition: origin, targetPosition: target }],
            getColor: axisColor,
            getWidth: 2,
            coordinateSystem,
        }));

        // Major and minor ticks
        for (let i = tickInterval / 2; i < length; i += tickInterval / 2) {
            const isMajor = i % tickInterval === 0;
            const tickStart = getTarget(axis as 'x' | 'y' | 'z', i);
            const tickEnd = [...tickStart] as [number, number, number];
            tickEnd[(idx + 1) % 3] += length * (isMajor ? 0.01 : 0.005);

            axes.push(new LineLayer({
                id: `${axisId}-tick-${i}`,
                data: [{ sourcePosition: tickStart, targetPosition: tickEnd }],
                getColor: axisColor,
                getWidth: isMajor ? 1 : 0.5,
                coordinateSystem,
            }));

            if (isMajor) {
                axes.push(new TextLayer({
                    id: `${axisId}-tick-label-${i}`,
                    data: [{ position: tickStart, text: `${i}${unitLabel}` }],
                    getColor: axisColor,
                    getSize: 12,
                    getTextAnchor: 'middle',
                    getAlignmentBaseline: 'top',
                    coordinateSystem,
                }));
            }
        }

        // Axis label
        const labelPos = getTarget(axis as 'x' | 'y' | 'z', length + labelOffset);
        axes.push(new TextLayer({
            id: `${axisId}-label`,
            data: [{ position: labelPos, text: axis.toUpperCase() }],
            getColor: axisColor,
            getSize: 16,
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
            coordinateSystem,
        }));
    });

    return axes;
}