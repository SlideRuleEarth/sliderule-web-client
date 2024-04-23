<script setup lang="ts">
    import { useRoute } from 'vue-router';
    import SrSideBar from "@/components/SrSideBar.vue";
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import { onMounted,ref } from 'vue';
    import SrAnalyzeOptSidebar from "@/components/SrAnalyzeOptSidebar.vue";
    import SrScatterPlot from "@/components/SrScatterPlot.vue";
    import { SrMenuItem } from "@/components/SrMenuInput.vue";
    import { useRequestsStore } from '@/stores/requestsStore';

    const requestsStore = useRequestsStore();
    // Use the useRoute function to access the current route
    const route = useRoute();
    // Access the `id` parameter from the route
    const defaultReqId = ref(Number(route.params.id));
    const reqIds  = ref<SrMenuItem[]>([]);
    const defaultMenuItemIndex = ref();

    const getMenuItems = async () =>  {
        const reqIds = await requestsStore.fetchReqIds();
        return reqIds.map((id: number) => {
            return {name: id.toString(), value: id.toString()};
        });
    };

    onMounted(() => {
        console.log('Loading AnalyzeView with ID:', defaultReqId.value); // Log the id to console or use it as needed
        getMenuItems().then((items) => {
            reqIds.value = items;
            defaultMenuItemIndex.value = reqIds.value.findIndex((item) => item.value === route.params.id.toString());
            console.log('reqIds:', reqIds.value, 'defaultMenuItemIndex:', defaultMenuItemIndex.value);
        });
        console.log('AnalyzeView onMounted');
    });
</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrSideBar>
                <template v-slot:sr-sidebar-body>
                    <SrAnalyzeOptSidebar :reqIds="reqIds" :defaultMenuItemIndex="defaultMenuItemIndex.toString()"/>
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
