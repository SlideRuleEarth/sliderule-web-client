<script setup lang="ts">
    import { useRoute } from 'vue-router';
    import SrSideBar from "@/components/SrSideBar.vue";
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import { onMounted,ref } from 'vue';
    import { useAnalyzeStore } from '@/stores/analyzeStore.js';
    import { useMapStore } from '@/stores/mapStore';
    import { createDeckGLInstance} from '@/composables/SrMapUtils';
    import { Map as OLMap } from 'ol';
    import SrAnalyzeOptSidebar from "@/components/SrAnalyzeOptSidebar.vue";
    import SrScatterPlot from "@/components/SrScatterPlot.vue";


    // Use the useRoute function to access the current route
    const route = useRoute();
    // Access the `id` parameter from the route
    const reqId = ref(Number(route.params.id));


    const analyzeStore = useAnalyzeStore();

    onMounted(() => {

        console.log('Loaded AnalyzeView with ID:', reqId.value); // Log the id to console or use it as needed
        const mapStore = useMapStore();
        const map = mapStore.getMap() as OLMap ;
        if (map){
            const tgt = map.getViewport() as HTMLDivElement; 
            const deckLayer = createDeckGLInstance(tgt);
            if(deckLayer){
                map.addLayer(deckLayer);
                console.log('deckLayer added:',deckLayer);
            } else {
                console.error('createDeckGLInstance returned null');
            }
        } else {
            console.error('map is null');
        }
        console.log('AnalyzeView onMounted');
    });
</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrSideBar>
                <template v-slot:sr-sidebar-body>
                    <SrAnalyzeOptSidebar :reqId="reqId"/>
                </template>
            </SrSideBar>
        </template>
        <template v-slot:main>
            <SrScatterPlot />
        </template>
    </TwoColumnLayout>
</template>
<style scoped>
    .sr-sidebar-body {
       width: 100%;
       min-height: 30vh;
    }
</style>
