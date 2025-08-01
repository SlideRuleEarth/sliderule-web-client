import { GeoJSON } from 'ol/format';
import type { Feature as OLFeature } from 'ol';
import type { Geometry } from 'ol/geom';
import shp from 'shpjs';
import { isValidGeometry } from '@/utils/isValidGeometry';
import { replaceEmptyGeometryWithBBox } from '@/utils/replaceEmptyGeometryWithBBox';
import { logFeatureSummary } from '@/utils/logFeatureSummary';

export async function readShapefileToOlFeatures(
    map_projection: string,
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
        const zipBuffer = await input.arrayBuffer();

        // Unzip manually to access .prj
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(zipBuffer);

        for (const filename of Object.keys(zip.files)) {
            const ext = filename.split('.').pop()?.toLowerCase();
            if (ext) {
                const fileData = await zip.files[filename].async('arraybuffer');
                fileMap[ext] = fileData;
            }
        }

        geojson = await shp(fileMap); // use full fileMap to parse shapefile with .prj included

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
    console.log("Shapefile read to GeoJSON:", geojson);
    // Check .prj for non-EPSG:4326 content
    let warning: string | null = null;
    let detectedProjection: string | null = null;
    let rawPrj: string | null = null;
    if (fileMap.prj) {
        const decoder = new TextDecoder('utf-8');
        rawPrj = decoder.decode(fileMap.prj).trim();
        const prjPreview = rawPrj.split('\n').join(' ').slice(0, 100) + '...';

        detectedProjection = prjPreview;

        let parsedProjection: string | null = null;
        let is4326 = false;

        try {
            const wktParser = (await import('wkt-parser')).default;
            const parsed = wktParser(rawPrj);

            // Heuristics to detect 4326
            // Handle both "GEOGCS.name" and root-level "name"
            // Heuristics to detect EPSG:4326
            const name = parsed?.name?.toLowerCase?.() ?? parsed?.GEOGCS?.name?.toLowerCase?.() ?? '';
            parsedProjection = parsed?.name ?? parsed?.GEOGCS?.name ?? null;

            is4326 = name.includes('wgs_1984') || name.includes('4326');

            if (!is4326) {
                warning = `Warning: .prj suggests non-EPSG:4326 projection: "${parsedProjection ?? 'unknown'}".\nRaw preview: ${prjPreview}`;
            }
        } catch (err) {
            warning = `Warning: Failed to parse .prj file.\nRaw: ${prjPreview}`;
        }
    }

    // Before OL conversion, preserve original geometries in a Map by index
    const rawGeometries = new Map<number, any>();
    if (geojson?.features?.length) {
        geojson.features.forEach((f: any, i: number) => {
            rawGeometries.set(i, f.geometry);
        });
    }

    const geojsonFormat = new GeoJSON();
    const rawFeatures = geojsonFormat.readFeatures(geojson, {
        featureProjection: map_projection,
        dataProjection: 'EPSG:4326',
    }) as OLFeature<Geometry>[];
    const repairedFeatures = rawFeatures.map((f, i) =>
        replaceEmptyGeometryWithBBox(f, rawGeometries.get(i))
    );    
    console.log('Raw shapefile features before repair:', rawFeatures);
    rawFeatures.forEach((f, i) => logFeatureSummary(f, i));

    repairedFeatures.forEach((f, i) => {
        if (f.get('sr_placeholder')) {
            console.log(`✅ Feature ${i} repaired from bbox`);
        } else if (!isValidGeometry(f.getGeometry())) {
            console.log(`❌ Feature ${i} is still invalid after attempted repair`);
        }
    });
    console.log('Repaired shapefile features:', repairedFeatures);
    repairedFeatures.forEach((f, i) => logFeatureSummary(f, i));

    // Filter only valid geometries
    const features = repairedFeatures.filter(f => isValidGeometry(f.getGeometry()));
    //const features = rawFeatures.filter(f => isValidGeometry(f.getGeometry()));
    console.log(`Filtered ${rawFeatures.length - features.length} invalid geometries`);

    console.log(`Loaded ${features.length} features from shapefile. with warning: ${warning} and rawPrj: ${rawPrj}`);
    return { features, warning, detectedProjection };
}
