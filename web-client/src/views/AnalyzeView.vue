<script setup lang="ts">
import { useRoute } from 'vue-router';
import SrSideBarLayout from "@/layouts/SrSideBarLayout.vue";
import TwoColumnLayout from "@/layouts/TwoColumnLayout.vue";
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
            <SrSideBarLayout>
                <template v-slot:sr-sidebar-body>
                    <SrAnalyzeOptSidebar :startingReqId="reqId"/>
                </template>
            </SrSideBarLayout>
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
