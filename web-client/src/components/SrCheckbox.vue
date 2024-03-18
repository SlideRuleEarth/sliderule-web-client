<template>
    <div class="sr-checkbox">
        <label class = 'sr-checkbox-label' :for="'sr-checkbox-' + label"> {{ label }} </label>
        <input :id="'sr-checkbox-' + label" type="checkbox" v-model="isChecked" @change="handleChange" />
    </div>
</template>

<script setup lang="ts">
import {ref} from 'vue';

const props = defineProps({
    label: {type:String,
            default: 'undefined'
    },
    default: {
        type: Boolean,
        default: false
    }
});

const isChecked = ref(props.default);


const emit = defineEmits(['update:modelValue']);

function handleChange(event) {
    console.log(`${props.label} SrCheckbox: ${event.target.checked}`);
    emit('update:modelValue', event.target.checked);
}
</script>

<style scoped>
.sr-checkbox {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.sr-checkbox-label {
    white-space: nowrap;
}
</style>
