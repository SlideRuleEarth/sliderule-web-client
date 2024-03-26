<template>
    <div class="sr-checkbox">
        <label class = 'sr-checkbox-label' :for="'sr-checkbox-' + label"> {{ label }} </label>
        <input :id="'sr-checkbox-' + label" type="checkbox" :checked="props.modelValue" @change="toggleChecked" />
    </div>
</template>

<script setup lang="ts">

const props = defineProps({
    label: {type:String,
            default: 'undefined'
    },
    modelValue: {
        type: Boolean,
        default: false
    },
    default: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue']);

const toggleChecked = () => {
    console.log(`${props.label} SrCheckbox: ${props.modelValue}`);
    emit('update:modelValue', !props.modelValue);
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
