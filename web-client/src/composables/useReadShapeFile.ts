import { GeoJSON } from 'ol/format';
import type { Feature as OLFeature } from 'ol';
import type { Geometry } from 'ol/geom';
import * as shapefile from 'shapefile';

export interface ShapefileInputs {
    shp: File;
    dbf: File;
    shx?: File;
}

/**
 * Reads shapefile components and returns OpenLayers features.
 * Throws on error.
 */
export async function readShapefileToOlFeatures({
    shp,
    dbf,
    shx,
}: ShapefileInputs): Promise<OLFeature<Geometry>[]> {
    try {
        const [shpBuf, dbfBuf, shxBuf] = await Promise.all([
            readFileAsync(shp),
            readFileAsync(dbf),
            shx ? readFileAsync(shx) : Promise.resolve(undefined),
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
        // Optional: you could wrap this in a custom error
        throw new Error("Failed to read shapefile: " + (err instanceof Error ? err.message : String(err)));
    }
}

// Helper for reading File as ArrayBuffer
export async function readFileAsync(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}
