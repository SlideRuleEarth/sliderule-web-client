// composables/useMapProjection.ts
import { ref, watchEffect } from 'vue';
import { useMapStore } from '@/stores/mapStore';

export function useMapProjection(defaultProjection = 'EPSG:3857') {
    const mapStore = useMapStore();
    const projection = ref<string>(defaultProjection);

    watchEffect(() => {
        const map = mapStore.getMap();
        const code = map?.getView().getProjection().getCode();
        if (code) projection.value = code;
    });

    return projection;
}
