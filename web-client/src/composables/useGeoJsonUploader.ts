import { useToast } from 'primevue/usetoast';
import { extractSrRegionFromGeometry, processConvexHull, addGeoJsonToLayer } from '@/utils/geojsonUploader';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { Map as OLMapType } from 'ol';
import type { SrRegion } from '@/types/SrTypes';
import VectorLayer from 'ol/layer/Vector';
import type { FileUploadUploaderEvent } from 'primevue/fileupload';
import { useMapStore } from '@/stores/mapStore';

export function useGeoJsonUploader( props: any, drawGeoJson: Function, zoomOutToFullMap: Function, upload_progress: any, upload_progress_visible: any) {
    const toast = useToast();
    const geoJsonStore = useGeoJsonStore();
    const reqParamsStore = useReqParamsStore();

    async function handleGeoJsonLoad(map: OLMapType, geoJsonData: any): Promise<number[] | undefined> {
        const features = geoJsonData.features;
        if (!features || features.length === 0) {
            toast.add({ severity: 'error', summary: 'GeoJSON Error', detail: 'GeoJSON file has no features', group: 'headless' });
            return;
        }

        const vectorLayer = map.getLayers().getArray().find((layer: any) =>
            layer.get('name') === (props.loadReqPoly ? 'Drawing Layer' : 'Uploaded Features')
        );

        const polyColor = 'rgba(255, 0, 0, 1)';   // red
        const hullColor = 'rgba(0, 0, 255, 1)';   // blue

        if (!vectorLayer || !(vectorLayer instanceof VectorLayer)) {
            toast.add({ severity: 'error', summary: 'Layer Error', detail: 'Could not find expected vector layer', group: 'headless' });
            return;
        }

        const vectorSource = vectorLayer.getSource();
        if (!vectorSource) {
            toast.add({ severity: 'error', summary: 'Source Error', detail: 'Vector layer has no source', group: 'headless' });
            return;
        }

        let combinedExtent: number[] | undefined;
        let allCoords: SrRegion = [];

        for (let fIndex = 0; fIndex < features.length; fIndex++) {
            const feature = features[fIndex];
            const geometry = feature.geometry;

            if (!geometry) continue;

            if (geometry.type === 'Polygon') {
                const srRegion = extractSrRegionFromGeometry(geometry);
                if (srRegion.length >= 3) {
                    allCoords.push(...srRegion);
                    const extent = drawGeoJson(`polygon-${fIndex + 1}`, vectorSource, JSON.stringify({ type: 'Feature', geometry }), polyColor, false, `polygon-${fIndex + 1}`);
                    if (extent) {
                        combinedExtent = expandExtent(combinedExtent, extent);
                    }
                } else {
                    toast.add({
                        severity: 'warn',
                        summary: 'Skipping Invalid Polygon',
                        detail: `Polygon in feature ${fIndex + 1} has less than 3 points.`,
                        group: 'headless'
                    });
                }

            } else if (geometry.type === 'MultiPolygon') {
                const polygons = geometry.coordinates as number[][][][];

                for (let i = 0; i < polygons.length; i++) {
                    const outerRing = polygons[i][0];
                    if (Array.isArray(outerRing) && outerRing.length >= 3) {
                        const srRegion: SrRegion = outerRing.map(coord => ({ lon: coord[0], lat: coord[1] }));
                        allCoords.push(...srRegion);

                        const polygonFeature = {
                            type: 'Feature',
                            geometry: {
                                type: 'Polygon',
                                coordinates: [outerRing]
                            }
                        };

                        const extent = drawGeoJson(`multipolygon-${fIndex + 1}-${i + 1}`, vectorSource, JSON.stringify(polygonFeature), polyColor, false, `polygon-${fIndex + 1}-${i + 1}`);
                        if (extent) {
                            combinedExtent = expandExtent(combinedExtent, extent);
                        }
                    } else {
                        toast.add({
                            severity: 'warn',
                            summary: 'Skipping Invalid MultiPolygon Part',
                            detail: `MultiPolygon part ${i + 1} in feature ${fIndex + 1} has less than 3 points.`,
                            group: 'headless'
                        });
                    }
                }

            } else {
                toast.add({
                    severity: 'warn',
                    summary: 'Unsupported Geometry',
                    detail: `Feature ${fIndex + 1} has unsupported geometry type: ${geometry.type}`,
                    group: 'headless'
                });
            }
        }

        // Now draw the combined convex hull in blue
        if (allCoords.length >= 3) {
            const { geoJson, label } = processConvexHull(allCoords);
            const extent = drawGeoJson('combined-convexHull', vectorSource, JSON.stringify(geoJson), hullColor, false, `${label}-combined`);
            if (extent) {
                combinedExtent = expandExtent(combinedExtent, extent);
            }

            if (props.loadReqPoly) {
                reqParamsStore.poly = reqParamsStore.convexHull;
            }
        } else {
            toast.add({
                severity: 'warn',
                summary: 'Convex Hull Skipped',
                detail: 'Not enough valid points to construct a convex hull.',
                group: 'headless'
            });
        }

        return combinedExtent;
    }


    // Utility to merge extents
    function expandExtent(current: number[] | undefined, next: number[]): number[] {
        if (!current) return next;
        return [
            Math.min(current[0], next[0]),
            Math.min(current[1], next[1]),
            Math.max(current[2], next[2]),
            Math.max(current[3], next[3])
        ];
    }

    async function handleUpload(event: FileUploadUploaderEvent) {
        const files = Array.isArray(event.files) ? event.files : [event.files];
        const file = files[0];

        if (!file) {
            toast.add({ severity: 'error', summary: 'Upload Error', detail: 'No file provided', group: 'headless' });
            return;
        }

        const reader = new FileReader();
        reader.readAsText(file);

        reader.onerror = (e) => {
            console.error('Error reading file:', e);
            toast.add({ severity: 'error', summary: 'File Read Error', detail: 'Unable to read the uploaded file', group: 'headless' });
        };

        reader.onload = async (e) => {
            const mapStore = useMapStore();
            const map = mapStore.getMap() as OLMapType;
            let drawExtent: number[] | undefined;

            try {
                if (!e.target || typeof e.target.result !== 'string') {
                    throw new Error('Invalid FileReader result');
                }

                const geoJsonData = JSON.parse(e.target.result);
                geoJsonStore.setGeoJsonData(geoJsonData);

                drawExtent = await handleGeoJsonLoad(map, geoJsonData);
            } catch (err: any) {
                console.error('Error parsing or loading GeoJSON:', err);
                toast.add({ severity: 'error', summary: 'Parse Error', detail: String(err), group: 'headless' });
            }

            if (drawExtent) {
                const [minX, minY, maxX, maxY] = drawExtent;
                const isZeroArea = minX === maxX || minY === maxY;

                if (!isZeroArea) {
                    const view = map.getView();
                    view.fit(drawExtent, {
                        size: map.getSize(),
                        padding: [40, 40, 40, 40],
                    });
                } else {
                    console.warn('Zero-area extent, zooming out to full map.');
                    zoomOutToFullMap(map);
                }
            }
        };

        if (props.reportUploadProgress) {
            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    upload_progress.value = percent;
                    if (!upload_progress_visible.value) {
                        upload_progress_visible.value = true;
                        toast.add({ severity: 'info', summary: 'Upload Progress', detail: `${percent}%`, group: 'headless' });
                    }
                }
            };
        }
    }

    return { handleUpload };
}
