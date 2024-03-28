<template>
    <div class="sr-checkbox">
        <label :class = "{'sr-checkbox-label':!insensitive, 'sr-checkbox-label-insensitive': insensitive }" :for="'sr-checkbox-' + label"> {{ label }} </label>
        <input :id="'sr-checkbox-' + label" type="checkbox" :checked="props.modelValue" @change="toggleChecked" :disabled="insensitive"/>
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
    },
    insensitive: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue']);

const toggleChecked = (e:any) => {
    console.log(`SrCheckbox: ${props.label}: ${props.modelValue}`);
    console.log(`SrCheckbox e.target.checked: ${props.label}: ${e.target.checked}`);
    emit('update:modelValue', e.target.checked);
}
</script>

<style scoped>
.sr-checkbox {
    display: flex;
    align-items: center;
    justify-content: flex-start;
}

.sr-checkbox-label {
    white-space: nowrap;
    font-size: small;
}

.sr-checkbox-label-insensitive {
    white-space: nowrap;
    color: #888; /*  grey color */
}
</style>
