<script setup lang="ts">
    import SrSideBar from "@/components/SrSideBar.vue";
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import SrSliderInput from "@/components/SrSliderInput.vue";
    import InputText from 'primevue/inputtext';
    import Slider from 'primevue/slider';
    import Button from 'primevue/button';
    import { ref,computed } from 'vue';

    const sliderValue = ref(50);
    const formattedValue = computed({
        get: () => sliderValue.value.toFixed(0), // Convert number to string with 2 decimal places
        set: (newValue) => {
            sliderValue.value = parseFloat(newValue) || 0; // Parse the input back to a number
        }
    });

    const stepValue = ref(10);
</script>

<template>
    <div class="advanced-user">
        <TwoColumnLayout>
            <template v-slot:sidebar-col>
                <SrSideBar>
                    <template v-slot:sr-sidebar-body>
                        <div class="card flex justify-content-center">
                            <div >
                                <InputText v-model="formattedValue"  :style="{ 'margin-bottom': '5%'}"/>
                                <Slider v-model="sliderValue" />
                                <p>Selected Value: {{ sliderValue }}</p>
                            </div>
                            <div class="card flex justify-content-center">
                                <SrSliderInput
                                    v-model="stepValue"
                                    label="Step:"
                                    :min="0"
                                    :max="100" 
                                    :decimal-places="2"                   
                                />
                            </div>  
                            <div class="run-sr-button" >
                                <Button label="Run SlideRule"></Button>
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
    .example-slider-input {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    }
    .run-sr-button {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        margin: 2rem;
    }
</style>