<script setup>
import SrSideBar from "@/components/SrSideBar.vue";
import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
import SrMap from "@/components/SrMap.vue";
import InputText from 'primevue/inputtext';
import Slider from 'primevue/slider';
import { ref } from 'vue';

const value = ref(0);
</script>

<template>
    <div class="advanced-user">
        <TwoColumnLayout>
            <template v-slot:header>
                <SrSideBar>
                    <template v-slot:sr-sidebar-body>
                        <div class="card flex justify-content-center">
                            <div class="w-14rem">
                                <InputText v-model.number="value" class="w-full" :style="{ 'margin-bottom': '10px'}"/>
                                <Slider v-model="value" class="w-full" />
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