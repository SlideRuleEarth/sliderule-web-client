import type { Feature } from 'ol';
import type { Geometry } from 'ol/geom';
import { Polygon, MultiPolygon, LineString, MultiLineString, Point, MultiPoint, GeometryCollection } from 'ol/geom';

export function logFeatureSummary(feature: Feature<Geometry>, index = 0): void {
    const geom = feature.getGeometry();
    if (!geom) {
        console.warn(`Feature ${index} has no geometry`);
        return;
    }

    const type = geom.getType();
    let coordinates: any = null;

    if (
        geom instanceof Polygon ||
        geom instanceof MultiPolygon ||
        geom instanceof LineString ||
        geom instanceof MultiLineString ||
        geom instanceof Point ||
        geom instanceof MultiPoint
    ) {
        coordinates = geom.getCoordinates();
    } else if (geom instanceof GeometryCollection) {
        coordinates = geom.getGeometries().map(g => ({
            type: g.getType(),
            coords: 'getCoordinates' in g ? (g as any).getCoordinates() : 'unknown'
        }));
    } else {
        coordinates = 'unsupported geometry type';
    }

    console.log(`Feature ${index}:`, {
        geometryType: type,
        extent: geom.getExtent(),
        coordinates,
        properties: feature.getProperties(),
    });
}
