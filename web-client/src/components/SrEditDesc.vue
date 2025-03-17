<script setup lang="ts">
import { db } from '@/db/SlideRuleDb';
import { ref, watch, onMounted } from 'vue';
import InputText from 'primevue/inputtext';
import FloatLabel from 'primevue/floatlabel';
import { useSrToastStore } from "@/stores/srToastStore";
import { useAnalysisMapStore } from '@/stores/analysisMapStore';

// Define props first
const props = defineProps({
    reqId: {
        type: Number,
        default: 0
    },
    label: {
        type: String,
        default: 'Description'
    }
});

const analysisMapStore = useAnalysisMapStore();

// Watch for changes in the reqId and fetch the description asynchronously
const fetchDescription = async () => {
    console.log('fetchDescription called with reqId:', props.reqId);
    if (props.reqId !== 0) {
        analysisMapStore.description = await db.getDescription(props.reqId);
    } else {
        analysisMapStore.description = 'No description available';
    }
};

onMounted(fetchDescription);

// Also, watch for changes in the `reqId` prop to re-fetch the description if needed
watch(() => props.reqId, fetchDescription);

const onEditComplete = (event: Event) => {
    const inputElement = event.target as HTMLInputElement;
    const newValue = inputElement.value.trim();
    analysisMapStore.description = newValue; // Update the specific field with the new value
    db.updateRequestRecord({ req_id: props.reqId, description: analysisMapStore.description},false);
    useSrToastStore().info('Description Updated', 'You updated the description',2000);
    //console.log('Edit completed, new value:', newValue, 'Description:', descrRef.value);
};
</script>

<template>
    <FloatLabel>
        <InputText
            v-model="analysisMapStore.description"
            class="p-inputtext p-component"
            @keydown.enter="onEditComplete"
            @blur="onEditComplete"
        />
        <label v-if="props.label !=''">{{ label }}</label>
    </FloatLabel>   
</template>

<style scoped>
</style>
