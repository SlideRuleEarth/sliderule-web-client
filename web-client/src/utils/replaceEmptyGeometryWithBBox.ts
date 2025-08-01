import { Polygon, Geometry } from 'ol/geom';
import { Feature } from 'ol';

export function replaceEmptyGeometryWithBBox(
    feature: Feature<Geometry>,
    rawGeometry?: any
): Feature<Geometry> {
    const geom = feature.getGeometry();
    const flat = (geom as any)?.flatCoordinates;

    const isEmpty = !geom || (Array.isArray(flat) && flat.length === 0);
    if (!isEmpty) return feature;

    const bbox = rawGeometry?.bbox;
    if (Array.isArray(bbox) && bbox.length === 4) {
        const [minX, minY, maxX, maxY] = bbox;
        const replacement = new Polygon([[
            [minX, minY],
            [minX, maxY],
            [maxX, maxY],
            [maxX, minY],
            [minX, minY]
        ]]);
        feature.setGeometry(replacement);
        feature.set('sr_placeholder', true);
        console.warn('✅ Replaced empty geometry using bbox:', bbox);
    } else {
        console.warn('⚠️ No bbox available to repair empty geometry:', rawGeometry);
    }

    return feature;
}
