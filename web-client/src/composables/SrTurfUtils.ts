import { featureCollection, point, convex, area } from '@turf/turf';
import type { SrLatLon, SrRegion } from '@/types/SrTypes';
import type { Polygon } from 'geojson';  // Import the correct GeoJSON type

export function isClockwise(coords: SrRegion): boolean {
    let wind = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        wind += (coords[i + 1].lon - coords[i].lon) * (coords[i + 1].lat + coords[i].lat);
    }
    return wind > 0;
}

export function convexHull(inputCoords: SrLatLon[]): SrLatLon[] {
    const points = inputCoords.map(coord => point([coord.lon, coord.lat]));
    const tfc = featureCollection(points);
    const hull = convex(tfc);
    if (!hull || !hull.geometry || hull.geometry.type !== 'Polygon') {
        throw new Error('Unable to compute convex hull or hull is not a polygon');
    }

    const coords: SrRegion = hull.geometry.coordinates[0].map((coord: number[]) => ({
        lon: coord[0],
        lat: coord[1],
    }));

    if (isClockwise(coords)) {
        //console.log('Convex hull is clockwise, reversing convex hull to make it counter-clockwise');
        coords.reverse();
    } else {
        //console.log('Convex hull is counter-clockwise');
    }

    return coords;
}

export function calculatePolygonArea(coords: SrLatLon[]): number {
    // Convert coordinates to a polygon
    const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [coords.map(coord => [coord.lon, coord.lat])]
    };

    // Calculate the area in square meters using turf's area function
    const areaSqMeters = area(polygon);

    // Convert square meters to square kilometers
    const areaSqKm = areaSqMeters / 1_000_000;
    
    return areaSqKm;
}

/**
 * Create a rectangular SrRegion polygon from min/max lat/lon.
 * - Order: CCW (SW → SE → NE → NW → back to SW)
 * - Returns undefined if any bound is missing.
 */
export function regionFromBounds(
    minLatitude?: number,
    maxLatitude?: number,
    minLongitude?: number,
    maxLongitude?: number,
    { close = true }: { close?: boolean } = {}
): SrRegion | undefined {
    if (
        minLatitude == null || maxLatitude == null ||
        minLongitude == null || maxLongitude == null
    ) return undefined;

    // Optionally: clamp to valid ranges
    const minLat = Math.max(-90, Math.min(90, minLatitude));
    const maxLat = Math.max(-90, Math.min(90, maxLatitude));
    const minLon = Math.max(-180, Math.min(180, minLongitude));
    const maxLon = Math.max(-180, Math.min(180, maxLongitude));

    // If bounds are inverted, swap
    const south = Math.min(minLat, maxLat);
    const north = Math.max(minLat, maxLat);
    const west  = Math.min(minLon, maxLon);
    const east  = Math.max(minLon, maxLon);

    const ring: SrRegion = [
        { lat: south, lon: west }, // SW
        { lat: south, lon: east }, // SE
        { lat: north, lon: east }, // NE
        { lat: north, lon: west }, // NW
    ];
    if (close) ring.push(ring[0]); // close the polygon
    return ring;
}
