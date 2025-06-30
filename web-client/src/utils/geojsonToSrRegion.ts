import type { SrRegion } from '@/types/SrTypes';

type GeoJsonPolygon = {
    type: 'Polygon';
    coordinates: number[][][];
};

export function geojsonPolygonToSrRegion(poly: unknown): SrRegion | null {
    if (
        typeof poly === 'object' &&
        poly !== null &&
        (poly as any).type === 'Polygon' &&
        Array.isArray((poly as any).coordinates) &&
        Array.isArray((poly as any).coordinates[0])
    ) {
        const outerRing = (poly as GeoJsonPolygon).coordinates[0];

        const validRing = outerRing.filter(
            (pt): pt is [number, number] => Array.isArray(pt) && pt.length === 2
        );

        return validRing.map(([lon, lat]) => ({ lon, lat }));
    }

    return null;
}