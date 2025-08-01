import type { Geometry } from 'ol/geom';

/**
 * Returns true if the geometry is non-null, has a valid extent,
 * and contains non-empty coordinates.
 */
export function isValidGeometry(geom: Geometry | undefined | null): boolean {
    if (!geom) return false;

    // Check extent
    const extent = geom.getExtent();
    if (extent.some(v => v == null || isNaN(v))) return false;

    // Check coordinates (only on types that support getCoordinates)
    const coords = (geom as any).getCoordinates?.();
    if (!Array.isArray(coords)) return false;

    // Check for non-empty coordinate arrays
    if (Array.isArray(coords) && coords.length === 0) return false;

    return true;
}
