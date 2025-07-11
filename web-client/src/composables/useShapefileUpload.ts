// src/composables/useShapefileUpload.ts
import type { Ref } from 'vue';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import type Map from 'ol/Map';
import * as shapefile from 'shapefile';

/**
 * Usage:
 *   const { handleShapefileUpload } = useShapefileUpload(vectorSource, map);
 *   <input @change="handleShapefileUpload" multiple />
 */
export function useShapefileUpload(vectorSource: VectorSource, map?: Map | Ref<Map | null>) {
    // Helper: read file as ArrayBuffer
    function readFileAsync(file: File): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async function handleShapefileUpload(event: Event) {
        const files = (event.target as HTMLInputElement).files;
        if (!files) return;

        const shpFile = Array.from(files).find(f => f.name.endsWith('.shp'));
        const dbfFile = Array.from(files).find(f => f.name.endsWith('.dbf'));
        const shxFile = Array.from(files).find(f => f.name.endsWith('.shx'));

        if (!shpFile || !dbfFile) {
            alert('Please provide at least .shp and .dbf files');
            return;
        }

        const [shpBuf, dbfBuf, shxBuf] = await Promise.all([
            readFileAsync(shpFile),
            readFileAsync(dbfFile),
            shxFile ? readFileAsync(shxFile) : Promise.resolve(undefined)
        ]);

        // Parse shapefile to GeoJSON
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

        // Add to OpenLayers vector source
        vectorSource.clear();
        const geojsonFormat = new GeoJSON();
        const olFeatures = geojsonFormat.readFeatures(geojson, {
            featureProjection: 'EPSG:3857',
        });
        vectorSource.addFeatures(olFeatures);

        // Zoom to data if map is provided
        const _map = typeof map === 'object' && 'value' in map ? map.value : map;
        if (_map && olFeatures.length) {
            const extent = vectorSource.getExtent();
            _map.getView().fit(extent, { maxZoom: 14, duration: 500 });
        }
    }

    return { handleShapefileUpload };
}
