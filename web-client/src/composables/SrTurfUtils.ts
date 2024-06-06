import { featureCollection, point, convex } from '@turf/turf';
import type { SrLatLon,SrRegion } from '@/sliderule/icesat2';

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

    if(isClockwise(coords)){
      console.log('Convex hull is clockwise, reversing convex hull to make it counter-clockwise');
      coords.reverse();
    } else {
      console.log('Convex hull is counter-clockwise');
    }

  return coords;
}
