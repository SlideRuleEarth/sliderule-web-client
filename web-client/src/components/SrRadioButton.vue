<template>
    <input
      type="radio"
      :value="value"
      :checked="isChecked"
      @change="$event.target && $emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <i class="material-icons">{{ icon }}</i>
</template>
  
<script setup lang="ts">
  import { computed, defineProps } from 'vue';
  
  const props = withDefaults(
    defineProps<{
      value?: string
      modelValue?: string
      icon?: string
    }>(),
    {
      value: undefined,
      modelValue: '',
      icon: ''
    },
  );
  
  defineEmits(['update:modelValue']);
  
  const isChecked = computed(() => {
    return props.modelValue === props.value;
  });
</script>
<style scoped>
    input[type='radio'] {
        margin: 0.25rem;
    }
</style>