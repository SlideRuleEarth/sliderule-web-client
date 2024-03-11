<template>
    <div class="sr-checkbox">
        <label> {{ label }} </label>
        <input type="checkbox" v-model="isChecked" @change="handleChange" />
    </div>
</template>

<script setup lang="ts">
import {ref} from 'vue';

const props = defineProps({
  label: String,
});

const isChecked = ref(false);


const emit = defineEmits(['update:modelValue']);

function handleChange(event) {
    console.log(`${props.label} SrCheckbox: ${event.target.checked}`);
}
</script>

<style scoped>
.sr-checkbox {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
</style>
