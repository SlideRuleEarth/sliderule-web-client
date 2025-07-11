import { GeoJSON } from 'ol/format';
import type { Feature as OLFeature } from 'ol';
import type { Geometry } from 'ol/geom';
import * as shapefile from 'shapefile';

// Supports both File and URL string
export type ShapefileInputSource = File | string;

export interface ShapefileInputs {
    shp: ShapefileInputSource;
    dbf: ShapefileInputSource;
    shx?: ShapefileInputSource;
}

/**
 * Reads shapefile components and returns OpenLayers features.
 * Accepts File or asset URL string for each part.
 */
export async function readShapefileToOlFeatures({
    shp,
    dbf,
    shx,
}: ShapefileInputs): Promise<OLFeature<Geometry>[]> {
    try {
        const [shpBuf, dbfBuf, shxBuf] = await Promise.all([
            loadAsArrayBuffer(shp),
            loadAsArrayBuffer(dbf),
            shx ? loadAsArrayBuffer(shx) : Promise.resolve(undefined),
        ]);

        const source = await shapefile.open(shpBuf, dbfBuf, shxBuf as any);
        const features: any[] = [];
        let result: { done: boolean; value: any };
        do {
            result = await source.read();
            if (!result.done) features.push(result.value);
        } while (!result.done);

        const geojson = {
            type: 'FeatureCollection',
            features
        };

        const geojsonFormat = new GeoJSON();
        const olFeatures = geojsonFormat.readFeatures(geojson, {
            featureProjection: 'EPSG:3857',
        }) as OLFeature<Geometry>[];

        return olFeatures;
    } catch (err) {
        throw new Error("Failed to read shapefile: " + (err instanceof Error ? err.message : String(err)));
    }
}

/**
 * Helper to load File or asset URL string as ArrayBuffer
 */
async function loadAsArrayBuffer(input: ShapefileInputSource): Promise<ArrayBuffer> {
    if (input instanceof File) {
        return readFileAsync(input);
    } else if (typeof input === "string") {
        const resp = await fetch(input);
        if (!resp.ok) throw new Error(`Failed to fetch asset: ${input}`);
        return await resp.arrayBuffer();
    } else {
        throw new Error('Invalid input type (expected File or URL string)');
    }
}

// Helper for reading File as ArrayBuffer
async function readFileAsync(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}
