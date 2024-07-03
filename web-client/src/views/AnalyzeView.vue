<script setup lang="ts">
import { useRoute } from 'vue-router';
import SrSideBar from "@/components/SrSideBar.vue";
import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
import { onMounted, ref } from 'vue';
import SrAnalyzeOptSidebar from "@/components/SrAnalyzeOptSidebar.vue";
import SrScatterPlot from "@/components/SrScatterPlot.vue";
import { useMapStore } from '@/stores/mapStore';

const mapStore = useMapStore();
const route = useRoute();
const reqId = ref(Number(route.params.id));

onMounted(async () => {
    console.log('AnalyzeView onMounted Loading AnalyzeView with ID:', reqId.value);
    
});

</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrSideBar>
                <template v-slot:sr-sidebar-body>
                    <SrAnalyzeOptSidebar :startingReqId="reqId"/>
                </template>
            </SrSideBar>
        </template>
        <template v-slot:main>
            <SrScatterPlot v-if="!mapStore.getIsLoading()"/>
        </template>
    </TwoColumnLayout>
</template>

<style scoped>
    .sr-sidebar-body {
        width: 100%;
        min-height: 30vh;
    }
</style>
