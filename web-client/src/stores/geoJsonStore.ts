import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useGeoJsonStore = defineStore('geoJson', () => {
    const reqGeoJsonData = ref<any>(null);
    const featuresGeoJsonData = ref<any>(null);

    function setReqGeoJsonData(data: any) {
        reqGeoJsonData.value = data;
    }

    function setFeaturesGeoJsonData(data: any) {
        featuresGeoJsonData.value = data;
    }

    function clearReqGeoJsonData() {
        reqGeoJsonData.value = null;
    }

    function clearFeaturesGeoJsonData() {
        featuresGeoJsonData.value = null;
    }

    function getReqGeoJsonData() {
        return reqGeoJsonData.value;
    }

    function getFeaturesGeoJsonData() {
        return featuresGeoJsonData.value;
    }

    function reqHasPoly(): boolean {
        const data = reqGeoJsonData.value;
        if (!data || !data.features || !Array.isArray(data.features)) {
            return false;
        }
        return data.features.some((feature: any) => {
            const type = feature?.geometry?.type;
            return type === 'Polygon' || type === 'MultiPolygon';
        });
    }

    return {
        setReqGeoJsonData,
        setFeaturesGeoJsonData,
        clearReqGeoJsonData,
        clearFeaturesGeoJsonData,
        getReqGeoJsonData,
        getFeaturesGeoJsonData,
        reqHasPoly,
    };
});
