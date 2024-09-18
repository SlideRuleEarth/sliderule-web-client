<script setup lang="ts">
import { db } from '@/db/SlideRuleDb';
import { ref, watch, onMounted } from 'vue';
import InputText from 'primevue/inputtext';

// Define props first
const props = defineProps({
    reqId: {
        type: Number,
        default: 0
    }
});

const descrRef = ref('default description');

// Watch for changes in the reqId and fetch the description asynchronously
const fetchDescription = async () => {
    console.log('fetchDescription called with reqId:', props.reqId);
    if (props.reqId !== 0) {
        descrRef.value = await db.getDescription(props.reqId);
    } else {
        descrRef.value = 'No description available';
    }
};

onMounted(fetchDescription);

// Also, watch for changes in the `reqId` prop to re-fetch the description if needed
watch(() => props.reqId, fetchDescription);

const onEditComplete = (event: Event) => {
    const inputElement = event.target as HTMLInputElement;
    const newValue = inputElement.value.trim();
    descrRef.value = newValue; // Update the specific field with the new value
    db.updateRequestRecord({ req_id: props.reqId, description: descrRef.value });
    console.log('Edit completed, new value:', newValue, 'Description:', descrRef.value);
};
</script>

<template>
    <InputText
        v-model="descrRef"
        class="p-inputtext p-component"
        @keydown.enter="onEditComplete"
        @blur="onEditComplete"
    />
</template>

<style scoped>
</style>
