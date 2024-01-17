<script setup lang="ts">
    import SrSideBar from "@/components/SrSideBar.vue";
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import SrSliderInput from "@/components/SrSliderInput.vue";
    import Button from 'primevue/button';
    import { ref } from 'vue';
    import { watchDebounced } from '@vueuse/core'


    const stepValue = ref(10);
    // Function that is called when stepValue changes
    const onStepValueChange = (newValue, oldValue) => {
        stepValue.value =newValue;
        console.log(`Step value changed from ${oldValue} to ${newValue}`,stepValue.value);
    };

    // Watcher for stepValue
    watchDebounced(
        stepValue,
        onStepValueChange,
        { debounce: 500, maxWait: 1000 },
    );
</script>

<template>
    <div class="advanced-user">
        <TwoColumnLayout>
            <template v-slot:sidebar-col>
                <SrSideBar>
                    <template v-slot:sr-sidebar-body>
                        <div class="card flex justify-content-center">
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