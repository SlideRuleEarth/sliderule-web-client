import type { SrRegion } from '@/types/SrTypes';
import { GeoJSON } from 'ol/format';
import { Style, Stroke } from 'ol/style';
import { getBoundingExtentFromFeatures } from '@/utils/SrMapUtils';
import { convexHull, isClockwise } from "@/composables/SrTurfUtils";
import { useReqParamsStore } from '@/stores/reqParamsStore';
import type OLMap from 'ol/Map.js';
import type { SrLonLatPoint } from '@/types/SrTypes';

export function extractSrRegionFromGeometry(geometry: any): SrRegion {
    if (geometry.type === 'Polygon') {
        const ring = geometry.coordinates[0];
        if (Array.isArray(ring) && ring.length > 1) {
            return ring.map((coord: number[]) => ({
                lon: coord[0],
                lat: coord[1],
            }));
        } else {
            console.error('Polygon has invalid coordinates:', JSON.stringify(geometry));
            throw new Error('Polygon has invalid coordinates');
        }
    }

    if (geometry.type === 'MultiPolygon') {
        const polygonRings = geometry.coordinates[0]; // first polygon
        if (Array.isArray(polygonRings) && polygonRings[0].length > 1) {
            const ring = polygonRings[0]; // first ring of the first polygon
            return ring.map((coord: number[]) => ({
                lon: coord[0],
                lat: coord[1],
            }));
        } else {
            console.error('MultiPolygon has invalid coordinates:', JSON.stringify(geometry));
            throw new Error('MultiPolygon has invalid coordinates');
        }
    }

    throw new Error(`Unsupported geometry type: ${geometry.type}`);
}


export function processConvexHull(region: SrRegion): { geoJson: any; label: string } {
    const reqParamsStore = useReqParamsStore();

    const cleanRegion = isClockwise(region) ? region.slice().reverse() : region;
    //reqParamsStore.setPoly(cleanRegion);

    const hull: SrLonLatPoint[] = convexHull(cleanRegion);
    reqParamsStore.setConvexHull(hull);

    const geoJson = {
        type: "Feature",
        geometry: {
            type: "Polygon",
            coordinates: [hull.map(({ lon, lat }) => [lon, lat])]
        },
        properties: {
            name: "Convex Hull Polygon"
        }
    };

    const label = reqParamsStore.getFormattedAreaOfConvexHull().toString();
    return { geoJson, label };
}
export function addGeoJsonToLayer(map: OLMap, vectorSource: any, geoJsonData: any): number[] | undefined {
    const format = new GeoJSON();
    const features = format.readFeatures(geoJsonData, {
        dataProjection: 'EPSG:4326',
        featureProjection: map.getView().getProjection(),
    });

    features.forEach(feature => {
        feature.setStyle(new Style({
            stroke: new Stroke({
                color: 'rgba(180, 100, 0, 1)',
                width: 2
            }),
        }));
    });

    const extent = getBoundingExtentFromFeatures(features);
    vectorSource.addFeatures(features);
    return extent;
}
