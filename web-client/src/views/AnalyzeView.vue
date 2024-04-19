<script setup lang="ts">
    import SrSideBar from "@/components/SrSideBar.vue";
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import { onMounted } from 'vue';
    import { useAnalyzeStore } from '@/stores/analyzeStore.js';
    import { useMapStore } from '@/stores/mapStore';
    import { createDeckGLInstance} from '@/composables/SrMapUtils';
    import { Map as OLMap } from 'ol';
    import SrAnalyzeOptSidebar from "@/components/SrAnalyzeOptSidebar.vue";


    const analyzeStore = useAnalyzeStore();

    onMounted(() => {

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
                    <SrAnalyzeOptSidebar/>
                </template>
            </SrSideBar>
        </template>
        <template v-slot:main>
            <SrScatterPlot />
        </template>
    </TwoColumnLayout>
</template>
