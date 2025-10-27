import { useToast } from 'primevue/usetoast';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { createLogger } from '@/utils/logger';

const logger = createLogger('useGeoJsonUploader');
import type OLMap from 'ol/Map.js';
import type { FileUploadUploaderEvent } from 'primevue/fileupload';
import { useMapStore } from '@/stores/mapStore';
import { handleGeoJsonLoad, zoomOutToFullMap } from '@/utils/SrMapUtils';

export function useGeoJsonUploader(
    props: any,
    upload_progress: any,
    upload_progress_visible: any,
    onDone?: () => void            // <-- callback from SFC
) {
    const toast = useToast();
    const geoJsonStore = useGeoJsonStore();
    const reqParamsStore = useReqParamsStore();

    function handleUpload(event: FileUploadUploaderEvent) {

        const files = Array.isArray(event.files) ? event.files : [event.files];
        const file = files[0];
        logger.debug('handleUpload called', { file: file.name, loadReqPoly: props.loadReqPoly });
        if (!file) {
            toast.add({ severity: 'error', summary: 'Upload Error', detail: 'No file provided' });
            return;
        }

        const reader = new FileReader();
        reader.readAsText(file);

        reader.onerror = (e) => {
            logger.error('Error reading file', { error: e });
            toast.add({ severity: 'error', summary: 'File Read Error', detail: 'Unable to read the uploaded file' });
        };

        reader.onload = async (e) => {
            const mapStore = useMapStore();
            const map = mapStore.getMap() as OLMap;
            let drawExtent: number[] | undefined;

            try {
                if (!e.target || typeof e.target.result !== 'string') {
                    throw new Error('Invalid FileReader result');
                }

                const geoJsonData = JSON.parse(e.target.result);
                logger.debug('Parsed GeoJSON data', { geoJsonData, uploadType: props.loadReqPoly ? 'request upload' : 'features upload' });
                if (props.loadReqPoly) {
                    geoJsonStore.setReqGeoJsonData(geoJsonData);
                } else {
                    geoJsonStore.setFeaturesGeoJsonData(geoJsonData);
                }

                // 👉 NEW: call the util version, pass loadReqPoly from props
                drawExtent = await handleGeoJsonLoad(map, geoJsonData, { loadReqPoly: !!props.loadReqPoly });

                logger.debug('After handleGeoJsonLoad', { poly: reqParamsStore.poly });
            } catch (err: any) {
                logger.error('Error parsing or loading GeoJSON', { error: err instanceof Error ? err.message : String(err) });
                toast.add({ severity: 'error', summary: 'Parse Error', detail: String(err) });
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
                    logger.warn('Zero-area extent, zooming out to full map');
                    zoomOutToFullMap(map);
                }
            }
        };

        reader.onloadend = (e) => {
            logger.debug('File read completed', { event: e });
            toast.add({ severity: 'success', summary: 'Upload Complete', detail: `File "${file.name}" uploaded successfully.`, life: 5000 });
            upload_progress.value = 100;
            upload_progress_visible.value = false;
            onDone?.();   // <-- notify SFC
        };

        if (props.reportUploadProgress) {
            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    upload_progress.value = percent;
                    if (upload_progress_visible.value) {
                        toast.add({ severity: 'info', summary: 'Upload Progress', detail: `${percent}%` });
                    }
                }
            };
        }
    }




    return { handleUpload };
}
