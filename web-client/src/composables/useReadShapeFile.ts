// useReadShapefile.ts
import { GeoJSON } from 'ol/format';
import type { Feature as OLFeature } from 'ol';
import type { Geometry } from 'ol/geom';
import shp from 'shpjs';

export type FileListInput = FileList;
export type UrlInput = Record<string, string>; // { shp: url, dbf: url, shx?: url }

export async function readShapefileToOlFeatures(
    input: FileListInput | UrlInput
): Promise<OLFeature<Geometry>[]> {
    let fileMap: Record<string, ArrayBuffer> = {};

    if (input instanceof FileList) {
        for (const file of Array.from(input)) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext) fileMap[ext] = await file.arrayBuffer();
        }
    } else {
        const fetches = await Promise.all(
            Object.entries(input).map(([ext, url]) =>
                fetch(url).then(resp => {
                    if (!resp.ok) throw new Error(`Failed to fetch ${url}`);
                    return resp.arrayBuffer();
                })
            )
        );
        fileMap = Object.fromEntries(Object.keys(input).map((k, i) => [k, fetches[i]]));
    }

    if (!fileMap.shp || !fileMap.dbf) {
        throw new Error("Missing required .shp or .dbf file");
    }

    const geojson = await shp(fileMap);
    const geojsonFormat = new GeoJSON();
    return geojsonFormat.readFeatures(geojson, {
        featureProjection: 'EPSG:3857',
    }) as OLFeature<Geometry>[];
}
