<script setup lang="ts">
import SrSideBar from "@/components/SrSideBar.vue";
import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
import SrMap from "@/components/SrMap.vue";
import InputText from 'primevue/inputtext';
import Slider from 'primevue/slider';
import { ref,computed } from 'vue';

const sliderValue = ref(50);
const formattedValue = computed({
    get: () => sliderValue.value.toFixed(0), // Convert number to string with 2 decimal places
    set: (newValue) => {
        sliderValue.value = parseFloat(newValue) || 0; // Parse the input back to a number
    }
});
</script>

<template>
    <div class="advanced-user">
        <TwoColumnLayout>
            <template v-slot:sidebar-col>
                <SrSideBar>
                    <template v-slot:sr-sidebar-body>
                        <div class="card flex justify-content-center">
                            <div class="w-14rem">
                                <InputText v-model="formattedValue"  :style="{ 'margin-bottom': '5%'}"/>
                                <Slider v-model="sliderValue" />
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