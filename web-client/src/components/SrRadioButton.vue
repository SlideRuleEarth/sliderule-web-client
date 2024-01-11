<template>
    <label class="radio-button-label">
      <input
        type="radio"
        :value="value"
        :checked="isChecked"
        @change="handleChange"
        class="radio-input"
      >
      <i class="material-icons">{{ icon }}</i>
    </label>
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
  
  const emit = defineEmits(['update:modelValue']);

  const isChecked = computed(() => {
    return props.modelValue === props.value;
  });
  const handleChange = (event: Event) => {
    //console.log(event);
    try{
      const target = event.target as HTMLInputElement;
      if (target) {
        //console.log(target.value);
        emit('update:modelValue', target.value);
      }
    } catch (error) {
      console.log(error);
    }
  };
</script>
<style scoped>
    /* Visually hide the radio input but keep it accessible */
    input[type='radio'] {
        margin: 0.25rem;
        opacity: 0;
        width: 0;
        height: 0;
        position: absolute;
    }
  /* Style for the icon  */
  .material-icons {
    cursor: pointer;
    font-weight:100
  }
  /* Style for the icon when the radio button is selected */
  input[type="radio"]:checked + .material-icons {
    /* Styles to highlight the active state, e.g., change color or add a border */
    color: blue;
    border: var(--border-width) solid var(--primary-color); 
  }</style>