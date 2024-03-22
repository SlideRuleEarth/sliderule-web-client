<script setup lang="ts">
import SrSideBar from "@/components/SrSideBar.vue";
import TwoColumnLayout from "@/layouts/TwoColumnLayout.vue";
import SrMap from "@/components/SrMap.vue";
import { onMounted } from 'vue';
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';

const advancedModeStore = useAdvancedModeStore();

onMounted(() => {
    advancedModeStore.advanced = false;
});

</script>

<template>
    <div class="general-user">
        <TwoColumnLayout>
            <template v-slot:sidebar-col>
                <SrSideBar>
                    <template v-slot:sr-sidebar-body>
                        <div class="card flex justify-content-center ">
                            <div class = "banner-margin">
                                <span>Recommended Settings for You</span>
                            </div>
                            <div class="card flex justify-content-center m-3">
                                <span>Surface Type</span>
                            </div> 
                            <div class="card flex justify-content-center">
                                <span>Filter Type</span>
                            </div>
                        </div>
                    </template>
                </SrSideBar>
            </template>
            <template v-slot:main>
                <SrMap />
            </template>
        </TwoColumnLayout>
    </div>
</template>
<style scoped>
    .banner-margin {
        margin-bottom: 1rem;
    }
</style>