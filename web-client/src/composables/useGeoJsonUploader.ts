import { useToast } from 'primevue/usetoast';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { Map as OLMapType } from 'ol';
import type { FileUploadUploaderEvent } from 'primevue/fileupload';
import { useMapStore } from '@/stores/mapStore';
import { handleGeoJsonLoad, zoomOutToFullMap } from '@/utils/SrMapUtils';


export function useGeoJsonUploader(
    props: any,
    upload_progress: any,
    upload_progress_visible: any,
) {
    const toast = useToast();
    const geoJsonStore = useGeoJsonStore();
    const reqParamsStore = useReqParamsStore();

    async function handleUpload(event: FileUploadUploaderEvent, isFeaturesUpload: boolean = false) {

        const files = Array.isArray(event.files) ? event.files : [event.files];
        const file = files[0];
        console.log('handleUpload called with file:', file, 'isFeaturesUpload:', isFeaturesUpload);
        if (!file) {
            toast.add({ severity: 'error', summary: 'Upload Error', detail: 'No file provided' });
            return;
        }

        const reader = new FileReader();
        reader.readAsText(file);

        reader.onerror = (e) => {
            console.error('Error reading file:', e);
            toast.add({ severity: 'error', summary: 'File Read Error', detail: 'Unable to read the uploaded file' });
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
                console.log('Parsed GeoJSON data:', geoJsonData, isFeaturesUpload ? '(features upload)' : '(request upload)');
                if (isFeaturesUpload) {
                    geoJsonStore.setFeaturesGeoJsonData(geoJsonData);
                } else {
                    geoJsonStore.setReqGeoJsonData(geoJsonData);
                }

                // 👉 NEW: call the util version, pass loadReqPoly from props
                drawExtent = await handleGeoJsonLoad(map, geoJsonData, { loadReqPoly: !!props.loadReqPoly });

                console.log('After handleGeoJsonLoad, reqParamsStore.poly:', reqParamsStore.poly);
            } catch (err: any) {
                console.error('Error parsing or loading GeoJSON:', err);
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
                    if (upload_progress_visible.value) {
                        toast.add({ severity: 'info', summary: 'Upload Progress', detail: `${percent}%` });
                    }
                }
            };
        }
    }

    async function handleReqUpload(event: FileUploadUploaderEvent) {
        console.log('handleReqUpload called');
        handleUpload(event);
    }

    async function handleFeaturesUpload(event: FileUploadUploaderEvent) {
        console.log('handleFeaturesUpload called');
        handleUpload(event, true);
    }


    return { handleReqUpload, handleFeaturesUpload };
}
