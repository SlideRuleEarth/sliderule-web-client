// @vitest-environment node

import type { ToastServiceMethods } from 'primevue/toastservice'; // v4 types
import { GeoJSON } from 'ol/format';
import type { Feature as OLFeature } from 'ol';
import { get as getProjection } from 'ol/proj';
import type { Geometry } from 'ol/geom';
import shp from 'shpjs';
import JSZip from 'jszip';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { useMapStore } from '@/stores/mapStore';
import type OLMap from 'ol/Map.js';
import { handleGeoJsonLoad, zoomOutToFullMap } from '@/utils/SrMapUtils';
import { prjToSupportedEpsg } from '@/utils/prjToEpsg';

// ----------  pure parser that returns raw GeoJSON ----------
export async function parseShapefileToGeoJSON(
    input: FileList | File | Record<string, string>
): Promise<{
    geojson: any;
    warning: string | null;
    detectedProjection: string | null;
}> {
    let fileMap: Record<string, ArrayBuffer> = {};
    let geojson: any;
    let detectedProjection: string | null = null;
    let warning: string | null = null;

    const isZipFile = (f: unknown): f is File =>
        f instanceof File && f.name.toLowerCase().endsWith('.zip');

    const isFileList = (f: unknown): f is FileList =>
        typeof FileList !== 'undefined' && f instanceof FileList;

    const isUrlMap = (f: unknown): f is Record<string, string> =>
        typeof f === 'object' && f !== null && !isFileList(f) && !(f instanceof File);

    if (isZipFile(input)) {
        const zipBuf = await input.arrayBuffer();
        const zip = await JSZip.loadAsync(zipBuf);

        let prjText: string | null = null;
        for (const name of Object.keys(zip.files)) {
            if (name.toLowerCase().endsWith('.prj')) {
                prjText = await zip.files[name].async('string');
                break;
            }
        }

        if (prjText) {
            const prjLower = prjText.toLowerCase();
            detectedProjection = prjLower.length > 120 ? prjLower.slice(0, 120) + '…' : prjLower;

            const is4326 =
                prjLower.includes('wgs_1984') &&
                (prjLower.includes('geographic') ||
                 prjLower.includes('gcs_wgs_1984') ||
                 prjLower.includes('4326'));

            if (!is4326) {
                warning = 'Warning: The shapefile .prj indicates a non-EPSG:4326 projection.';
            }
        }

        geojson = await shp(zipBuf);
    } else if (isFileList(input)) {
        for (const file of Array.from(input)) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext) fileMap[ext] = await file.arrayBuffer();
        }
        if (fileMap.prj) {
            const prj = new TextDecoder('utf-8').decode(fileMap.prj).toLowerCase();
            detectedProjection = prj.length > 120 ? prj.slice(0, 120) + '…' : prj;

            const is4326 =
                prj.includes('wgs_1984') &&
                (prj.includes('geographic') || prj.includes('gcs_wgs_1984') || prj.includes('4326'));

            if (!is4326) {
                warning = 'Warning: The shapefile .prj indicates a non-EPSG:4326 projection.';
            }
        }
        geojson = await shp(fileMap);
    } else if (isUrlMap(input)) {
        const entries = Object.entries(input);
        const buffers = await Promise.all(
            entries.map(([_, url]) =>
                fetch(url).then(resp => {
                    if (!resp.ok) throw new Error(`Failed to fetch ${url}`);
                    return resp.arrayBuffer();
                })
            )
        );
        fileMap = Object.fromEntries(entries.map(([ext], i) => [ext.toLowerCase(), buffers[i]]));

        if (fileMap.prj) {
            const prj = new TextDecoder('utf-8').decode(fileMap.prj).toLowerCase();
            detectedProjection = prj.length > 120 ? prj.slice(0, 120) + '…' : prj;

            const is4326 =
                prj.includes('wgs_1984') &&
                (prj.includes('geographic') || prj.includes('gcs_wgs_1984') || prj.includes('4326'));

            if (!is4326) {
                warning = 'Warning: The shapefile .prj indicates a non-EPSG:4326 projection.';
            }
        }

        geojson = await shp(fileMap);
    } else {
        throw new Error('Unsupported shapefile input type');
    }

    return { geojson, warning, detectedProjection };
}

/**
 * High-level loader that:
 *  - parses shapefile -> GeoJSON
 *  - writes to geoJsonStore (req vs features)
 *  - paints features via handleGeoJsonLoad
 *  - fits/zooms like your uploader
 */

export async function loadShapefileToMap(
  input: FileList | File | Record<string, string>,
  options: {
    loadReqPoly?: boolean;
    map?: OLMap | null;
    fitToExtent?: boolean;
    toast?: ToastServiceMethods;   // <-- accept a toast instance
    toastLifeMs?: number;
  } = {}
) {
  const {
    loadReqPoly = false,
    fitToExtent = true,
    toast,
    toastLifeMs = 5000
  } = options;

  const geoJsonStore = useGeoJsonStore();
  const reqParamsStore = useReqParamsStore();
  const map = options.map ?? useMapStore().getMap();
  let drawExtent: number[] | undefined;
  const { geojson, warning, detectedProjection } = await parseShapefileToGeoJSON(input);
  console.log('Shapefile parsed:', { geojson, warning, detectedProjection });
  if (loadReqPoly) geoJsonStore.setReqGeoJsonData(geojson);
  else geoJsonStore.setFeaturesGeoJsonData(geojson);
  if(map){
    drawExtent = await handleGeoJsonLoad(map as OLMap, geojson, { loadReqPoly });

    if (fitToExtent && drawExtent) {
        const [minX, minY, maxX, maxY] = drawExtent;
        if (minX !== maxX && minY !== maxY) {
            map.getView().fit(drawExtent, { size: map.getSize(), padding: [40, 40, 40, 40] });
        } else {
            zoomOutToFullMap(map as OLMap);
        }
    }
  } else {
    console.error('loadShapefileToMap: No map available to display shapefile features.');
  }

  // Only use toast if the caller passed it in
  if (toast) {
    toast.add({
      severity: 'success',
      summary: 'Shapefile Loaded',
      detail: warning ? `Parsed successfully. Note: ${warning}` : 'Parsed and displayed successfully.',
      life: toastLifeMs
    });
    if (detectedProjection) {
      toast.add({
        severity: 'info',
        summary: 'Detected .prj',
        detail: detectedProjection,
        life: Math.min(8000, toastLifeMs + 3000)
      });
    }
  }

  console.log('After shapefile load, reqParamsStore.poly:', reqParamsStore.poly);
  return { warning, detectedProjection, drawExtent };
}

export async function readShapefileToOlFeatures(
    input: FileList | File | Record<string, string>,
    opts?: { sourceCRS?: string | null; targetCRS?: string }
): Promise<{
    features: OLFeature<Geometry>[];
    warning: string | null;
    detectedProjection: string | null;
}> {
    let fileMap: Record<string, ArrayBuffer> = {};
    let geojson: any;
    let prjText: string | null = null;

    const isZipFile = (f: unknown): f is File =>
        f instanceof File && f.name.toLowerCase().endsWith('.zip');

    const isFileList = (f: unknown): f is FileList =>
        typeof FileList !== 'undefined' && f instanceof FileList;

    const isUrlMap = (f: unknown): f is Record<string, string> =>
        typeof f === 'object' && f !== null && !isFileList(f) && !(f instanceof File);

    // Values we’ll compute regardless of branch
    let detectedProjection: string | null = null;
    let warning: string | null = null;

    if (isZipFile(input)) {
        console.log('readShapefileToOlFeatures: processing zip file input:', input);

        // 1) Extract PRJ (if present) from the zip
        const zipBuf = await input.arrayBuffer();
        const zip = await JSZip.loadAsync(zipBuf);

        // Find the first *.prj (case-insensitive), ignoring folder paths
        for (const name of Object.keys(zip.files)) {
            if (name.toLowerCase().endsWith('.prj')) {
                prjText = await zip.files[name].async('string');
                break;
            }
        }

        if (prjText) {
            const prjLower = prjText.toLowerCase();
            // Nice preview without always adding ellipsis
            const preview = prjLower.length > 120 ? prjLower.slice(0, 120) + '…' : prjLower;
            detectedProjection = preview;
            console.log('Detected .prj content:', prjLower);

            const is4326 =
                prjLower.includes('wgs_1984') &&
                (prjLower.includes('geographic') ||
                 prjLower.includes('gcs_wgs_1984') ||
                 prjLower.includes('4326'));

            if (!is4326) {
                warning = `Warning: The shapefile's .prj indicates a non-EPSG:4326 projection. This may cause misalignment.`;
                console.warn(warning, 'Detected .prj content:', prjLower);
            } else {
                console.log('Shapefile .prj indicates EPSG:4326 projection.');
            }
        } else {
            console.log('No .prj found in zip.');
        }

        // 2) Convert to GeoJSON as before
        geojson = await shp(zipBuf);
        console.log('readShapefileToOlFeatures: processed zip file geojson:', geojson);
    } else if (isFileList(input)) {
        console.log('readShapefileToOlFeatures: processing FileList input:', input);
        for (const file of Array.from(input)) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext) fileMap[ext] = await file.arrayBuffer();
        }
        // Detect PRJ here (existing behavior)
        if (fileMap.prj) {
            const prj = new TextDecoder('utf-8').decode(fileMap.prj).toLowerCase();
            const preview = prj.length > 120 ? prj.slice(0, 120) + '…' : prj;
            detectedProjection = preview;

            const is4326 =
                prj.includes('wgs_1984') &&
                (prj.includes('geographic') || prj.includes('gcs_wgs_1984') || prj.includes('4326'));

            if (!is4326) {
                warning = `Warning: The shapefile's .prj indicates a non-EPSG:4326 projection. This may cause misalignment.`;
            }
        }
        geojson = await shp(fileMap);
    } else if (isUrlMap(input)) {
        console.log('readShapefileToOlFeatures: processing URL map input:', input);
        const entries = Object.entries(input);
        const buffers = await Promise.all(
            entries.map(([_, url]) =>
                fetch(url).then(resp => {
                    if (!resp.ok) throw new Error(`Failed to fetch ${url}`);
                    return resp.arrayBuffer();
                })
            )
        );
        fileMap = Object.fromEntries(entries.map(([ext], i) => [ext.toLowerCase(), buffers[i]]));

        if (fileMap.prj) {
            const prj = new TextDecoder('utf-8').decode(fileMap.prj).toLowerCase();
            const preview = prj.length > 120 ? prj.slice(0, 120) + '…' : prj;
            detectedProjection = preview;

            const is4326 =
                prj.includes('wgs_1984') &&
                (prj.includes('geographic') || prj.includes('gcs_wgs_1984') || prj.includes('4326'));

            if (!is4326) {
                warning = `Warning: The shapefile's .prj indicates a non-EPSG:4326 projection. This may cause misalignment.`;
            }
        }

        geojson = await shp(fileMap);
    } else {
        throw new Error('Unsupported shapefile input type');
    }

    const forced = opts?.sourceCRS ?? null;
    const detected = prjToSupportedEpsg(prjText ?? null);
    let sourceCRS = forced || detected || 'EPSG:4326';

    // Use the map’s current projection as target (or the override)
    const mapTarget = useMapStore().getSrViewObj()?.projectionName || 'EPSG:3857';
    const targetCRS = opts?.targetCRS || mapTarget;

    // If for some reason it’s not registered, fall back safely
    const haveSource = !!getProjection(sourceCRS);
    const haveTarget = !!getProjection(targetCRS);

    if (!haveSource) {
        warning = `Source CRS ${sourceCRS} is not registered; assuming EPSG:4326.`;
        sourceCRS = 'EPSG:4326';
    }
    if (!haveTarget) {
        warning = (warning ? warning + ' ' : '') + `Target CRS ${targetCRS} is not registered; features will not be reprojected.`;
    }

    const features = new GeoJSON().readFeatures(geojson, {
        dataProjection: sourceCRS,
        featureProjection: haveTarget ? targetCRS : undefined,
    });
    console.log(`Converted GeoJSON to OL features: ${features.length} features, from ${sourceCRS} to ${targetCRS}`, { features });
    return {
        features,
        warning,
        detectedProjection: detected || 'EPSG:4326',
    };
}