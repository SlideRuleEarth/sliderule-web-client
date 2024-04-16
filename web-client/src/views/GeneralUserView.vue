<script setup lang="ts">
import TwoColumnLayout from "@/layouts/TwoColumnLayout.vue";
import SrSideBarLayout from "@/layouts/SrSideBarLayout.vue";
import SrMap from "@/components/SrMap.vue";
import { onMounted } from 'vue';
import SrModeSelect from "@/components/SrModeSelect.vue";
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';

const advancedModeStore = useAdvancedModeStore();

onMounted(() => {
    advancedModeStore.advanced = false;
});

</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrSideBarLayout>
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
                <template v-slot:sr-sidebar-footer>
                    <SrModeSelect /> 
                </template>
            </SrSideBarLayout>
        </template>
        <template v-slot:main>
            <SrMap />
        </template>
    </TwoColumnLayout>
</template>
<style scoped>
    .banner-margin {
        margin-bottom: 1rem;
    }
</style>