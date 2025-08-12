import { GeoJSON } from 'ol/format';
import type { Feature as OLFeature } from 'ol';
import type { Geometry } from 'ol/geom';
import shp from 'shpjs';
 
export async function readShapefileToOlFeatures(
    input: FileList | File | Record<string, string>
): Promise<{
    features: OLFeature<Geometry>[];
    warning: string | null;
    detectedProjection: string | null;
}> {
    let fileMap: Record<string, ArrayBuffer> = {};
    let geojson;

    const isZipFile = (f: unknown): f is File =>
        f instanceof File && f.name.toLowerCase().endsWith('.zip');

    const isFileList = (f: unknown): f is FileList =>
        typeof FileList !== 'undefined' && f instanceof FileList;

    const isUrlMap = (f: unknown): f is Record<string, string> =>
        typeof f === 'object' && f !== null && !isFileList(f) && !(f instanceof File);

    if (isZipFile(input)) {
        geojson = await shp(await input.arrayBuffer());
    } else if (isFileList(input)) {
        for (const file of Array.from(input)) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext) fileMap[ext] = await file.arrayBuffer();
        }
        geojson = await shp(fileMap);
    } else if (isUrlMap(input)) {
        const entries = Object.entries(input);
        const buffers = await Promise.all(entries.map(([_, url]) =>
            fetch(url).then(resp => {
                if (!resp.ok) throw new Error(`Failed to fetch ${url}`);
                return resp.arrayBuffer();
            })
        ));
        fileMap = Object.fromEntries(entries.map(([ext], i) => [ext, buffers[i]]));
        geojson = await shp(fileMap);
    } else {
        throw new Error("Unsupported shapefile input type");
    }

    // Check .prj for non-EPSG:4326 content
    let warning: string | null = null;
    let detectedProjection: string | null = null;

    if (fileMap.prj) {
        const decoder = new TextDecoder('utf-8');
        const prj = decoder.decode(fileMap.prj).toLowerCase();

        detectedProjection = prj.trim().split('\n').join(' ').slice(0, 100) + '...'; // preview

        const is4326 =
            prj.includes("wgs_1984") &&
            (prj.includes("geographic") || prj.includes("gcs_wgs_1984") || prj.includes("4326"));

        if (!is4326) {
            warning = `Warning: The shapefile's .prj indicates a non-EPSG:4326 projection. This may cause misalignment.`;
        }
    }

    const geojsonFormat = new GeoJSON();
    const features = geojsonFormat.readFeatures(geojson, {
        featureProjection: 'EPSG:3857', // Map projection
        dataProjection: 'EPSG:4326',     // Assume input is in EPSG:4326
    }) as OLFeature<Geometry>[];

return { features, warning, detectedProjection };
}
