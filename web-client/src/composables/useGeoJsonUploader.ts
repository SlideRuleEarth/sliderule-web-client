import { useToast } from 'primevue/usetoast';
import { extractSrRegionFromGeometry, processConvexHull, addGeoJsonToLayer } from '@/utils/geojsonUploader';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { Map as OLMapType } from 'ol';
import type { SrRegion } from '@/types/SrTypes';
import VectorLayer from 'ol/layer/Vector';
import type { FileUploadUploaderEvent } from 'primevue/fileupload';

export function useGeoJsonUploader(mapStore: any, props: any, drawGeoJson: Function, zoomOutToFullMap: Function, upload_progress: any, upload_progress_visible: any) {
    const toast = useToast();
    const geoJsonStore = useGeoJsonStore();
    const reqParamsStore = useReqParamsStore();

    async function handleGeoJsonLoad(map: OLMapType, geoJsonData: any): Promise<number[] | undefined> {
        const features = geoJsonData.features;
        if (!features || features.length === 0) {
            toast.add({ severity: 'error', summary: 'GeoJSON Error', detail: 'GeoJSON file has no features', group: 'headless' });
            return;
        }

        let vectorLayer = map.getLayers().getArray().find((layer: any) =>
            layer.get('name') === (props.loadReqPoly ? 'Drawing Layer' : 'Uploaded Features')
        );

        const color = props.loadReqPoly ? 'rgba(255, 0, 0, 1)' : 'rgba(180, 100, 0, 1)';
        if (!vectorLayer || !(vectorLayer instanceof VectorLayer)) {
            toast.add({ severity: 'error', summary: 'Layer Error', detail: 'Could not find expected vector layer', group: 'headless' });
            return;
        }

        const vectorSource = vectorLayer.getSource();
        if (!vectorSource) {
            toast.add({ severity: 'error', summary: 'Source Error', detail: 'Vector layer has no source', group: 'headless' });
            return;
        }

        // Initial drawing
        let drawExtent = drawGeoJson('fromFile', vectorSource, geoJsonData, color, true);

        if (props.loadReqPoly) {
            if (features.length > 1) {
                toast.add({
                    severity: 'error',
                    summary: 'Multiple Features Warning',
                    detail: 'Only one polygon feature is allowed for request input.',
                    group: 'headless'
                });
                return;
            }

            try {
                const geometry = features[0].geometry;
                const srRegion: SrRegion = extractSrRegionFromGeometry(geometry);
                const polygonRings = geometry.coordinates[0]; // first polygon

                if(geometry.type === "MultiPolygon" && Array.isArray(polygonRings) && polygonRings[0].length > 1) {
                    toast.add({
                        severity: 'warn',
                        summary: 'MultiPolygon Warning',
                        detail: 'Using first polygon of MultiPolygon for request input.',
                        group: 'headless'
                    });
                }
                if (srRegion.length < 3) {
                    toast.add({
                        severity: 'error',
                        summary: 'Convex Hull Error',
                        detail: `Region requires at least 3 points, got ${srRegion.length}`,
                        group: 'headless'
                    });
                    return;
                } 

                const { geoJson, label } = processConvexHull(srRegion);
                drawExtent = drawGeoJson('convexHull', vectorSource, JSON.stringify(geoJson), 'rgba(255, 0, 0, 1)', false, label);
                reqParamsStore.poly = reqParamsStore.convexHull;
                return drawExtent;

            } catch (err: any) {
                console.error('Convex hull error:', err);
                toast.add({
                    severity: 'error',
                    summary: 'Geometry Error',
                    detail: String(err),
                    group: 'headless'
                });
            }
        } else {
            // Just add all features
            return addGeoJsonToLayer(map, vectorSource, geoJsonData);
        }
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
