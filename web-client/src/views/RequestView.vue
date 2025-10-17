<script setup lang="ts">
    import MainTwoColumnLayout from "../layouts/MainTwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import { onMounted, nextTick, watch } from 'vue';
    import SrSideBar from "@/components/SrSideBar.vue";
    import { useRoute, useRouter } from 'vue-router';
    import { db } from '@/db/SlideRuleDb';
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import { useRasterParamsStore } from "@/stores/rasterParamsStore";
    import { useAdvancedModeStore } from "@/stores/advancedModeStore";
    import { applyParsedJsonToStores } from "@/utils/applyParsedJsonToStores";
    import { useToast } from "primevue/usetoast";
    import { useSrToastStore } from "@/stores/srToastStore";

    const route = useRoute();
    const router = useRouter();
    const toast = useToast();
    const srToastStore = useSrToastStore();

    async function loadParametersFromRequest(reqId: number) {
        console.log('loadParametersFromRequest called with reqId:', reqId);
        try {
            // Get the request parameters from the database
            const request = await db.getRequest(reqId);
            console.log('Retrieved request from DB:', request);

            // Use rcvd_parms (received parameters) which contains the actual parameters sent to server
            // This works for both regular requests and imported requests
            let parameters = null;
            if (request?.rcvd_parms) {
                try {
                    // rcvd_parms might be a JSON string or already an object
                    parameters = typeof request.rcvd_parms === 'string'
                        ? JSON.parse(request.rcvd_parms)
                        : request.rcvd_parms;
                    console.log('Using rcvd_parms as parameters:', parameters);
                } catch (error) {
                    console.error('Failed to parse rcvd_parms:', error);
                }
            }

            // Fallback to request.parameters if rcvd_parms is not available
            if (!parameters && request?.parameters && Object.keys(request.parameters).length > 0) {
                parameters = request.parameters;
                console.log('Falling back to request.parameters:', parameters);
            }

            if (request && parameters && Object.keys(parameters).length > 0) {
                // Force advanced mode when loading params from a request
                console.log('Setting advanced mode to true');
                useAdvancedModeStore().setAdvanced(true);

                // Wait for the DOM to update with the advanced sidebar
                await nextTick();

                // Wait a bit more to ensure advanced mode sidebar components are fully ready
                await new Promise(resolve => setTimeout(resolve, 300));

                // Now load parameters into stores
                const reqParamsStore = useReqParamsStore();
                const rasterParamsStore = useRasterParamsStore();

                const errors: string[] = [];
                const addError = (section: string, message: string) => {
                    errors.push(`${section}: ${message}`);
                };

                console.log('Applying parameters to stores:', parameters);
                applyParsedJsonToStores(parameters, reqParamsStore, rasterParamsStore, addError);

                // Set mission and API based on the func field or asset field
                if (request.func) {
                    const func = request.func.toLowerCase();

                    // Determine mission from asset or function name
                    if (parameters.asset?.includes('icesat2') || func.startsWith('atl')) {
                        reqParamsStore.setMissionValue('ICESat-2');

                        // Map function name to API
                        // Handle the special cases for atl03x variants
                        // Check for fit in both parameters.fit (rcvd_parms) and parameters.parms?.fit (original parameters)
                        if (func === 'atl03x-surface' || (func === 'atl03x' && (parameters.fit || parameters.parms?.fit))) {
                            reqParamsStore.setIceSat2API('atl03x-surface');
                        } else if (func === 'atl03x-phoreal' || (func === 'atl03x' && (parameters.phoreal || parameters.parms?.phoreal))) {
                            reqParamsStore.setIceSat2API('atl03x-phoreal');
                        } else if (func === 'atl03x' || func === 'atl03vp') {
                            reqParamsStore.setIceSat2API(func);
                        } else if (func === 'atl06p' || func === 'atl06sp') {
                            reqParamsStore.setIceSat2API(func);
                        } else if (func === 'atl08p') {
                            reqParamsStore.setIceSat2API('atl08p');
                        } else if (func === 'atl13x') {
                            reqParamsStore.setIceSat2API('atl13x');
                        } else if (func === 'atl24x') {
                            reqParamsStore.setIceSat2API('atl24x');
                        }
                    } else if (parameters.asset?.includes('gedi') || func.startsWith('gedi')) {
                        reqParamsStore.setMissionValue('GEDI');

                        // Map function name to API
                        if (func === 'gedi01bp') {
                            reqParamsStore.setGediAPI('gedi01bp');
                        } else if (func === 'gedi02ap') {
                            reqParamsStore.setGediAPI('gedi02ap');
                        } else if (func === 'gedi04ap') {
                            reqParamsStore.setGediAPI('gedi04ap');
                        }
                    }

                    console.log('Set mission to:', reqParamsStore.getMissionValue(), 'API to:', reqParamsStore.getIceSat2API() || reqParamsStore.getGediAPI());
                }

                if (errors.length > 0) {
                    console.warn('Errors loading parameters:', errors);
                }

                // Wait one more tick to ensure stores have updated
                await nextTick();

                // Zoom to the polygon if it exists
                if (parameters.poly && parameters.poly.length > 0) {
                    const mapStore = await import('@/stores/mapStore').then(m => m.useMapStore());
                    const map = mapStore.getMap();
                    if (map) {
                        // Import the necessary OpenLayers functions
                        const { fromLonLat } = await import('ol/proj');
                        const { boundingExtent } = await import('ol/extent');

                        // Get the current projection
                        const currentProjection = mapStore.getSrViewObj()?.projectionName || 'EPSG:3857';

                        // Convert polygon coordinates to the map projection and create extent
                        const coords = parameters.poly.map((point: {lon: number, lat: number}) =>
                            fromLonLat([point.lon, point.lat], currentProjection)
                        );
                        const extent = boundingExtent(coords);

                        // Zoom to the extent with padding
                        map.getView().fit(extent, {
                            size: map.getSize(),
                            padding: [40, 40, 40, 40],
                            duration: 500
                        });
                        console.log('Zoomed to polygon extent');
                    }
                }

                console.log('Parameters loaded successfully, showing toast');
                toast.add({
                    severity: 'success',
                    summary: 'Parameters Loaded',
                    detail: `Parameters from request ${reqId} loaded successfully`,
                    life: srToastStore.getLife()
                });
            } else {
                console.warn('No parameters found for request:', reqId);
                toast.add({
                    severity: 'warn',
                    summary: 'No Parameters',
                    detail: `No parameters found for request ${reqId}`,
                    life: srToastStore.getLife()
                });
            }
        } catch (error) {
            console.error(`Failed to load parameters for request ${reqId}:`, error);
            toast.add({
                severity: 'error',
                summary: 'Load Failed',
                detail: `Failed to load parameters for request ${reqId}`,
                life: srToastStore.getLife()
            });
        }
    }

    onMounted(async () => {
        console.log('RequestView onMounted, route.params:', route.params);

        // Check if we have a reqId in the route params
        const reqIdParam = route.params.reqId;
        if (reqIdParam) {
            const reqId = parseInt(reqIdParam as string, 10);
            if (!isNaN(reqId)) {
                console.log('Found reqId in route params:', reqId);
                await loadParametersFromRequest(reqId);

                // Navigate to the clean /request URL after loading
                router.replace({ path: '/request' });
            }
        }
    });

    // Also watch for route changes in case user navigates to /request/:reqId while already on /request
    watch(() => route.params.reqId, async (newReqId) => {
        if (newReqId) {
            const reqId = parseInt(newReqId as string, 10);
            if (!isNaN(reqId)) {
                console.log('Route params changed, loading reqId:', reqId);
                await loadParametersFromRequest(reqId);
                router.replace({ path: '/request' });
            }
        }
    });

</script>

<template>
    <MainTwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrSideBar />
        </template>
        <template v-slot:main>
            <SrMap />
        </template>
    </MainTwoColumnLayout>
</template>
<style scoped>

</style>