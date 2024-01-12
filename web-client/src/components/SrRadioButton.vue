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
  .radio-button-label {
    display: flex; /* Aligns children (input and icon) in a row */
    flex-direction: column; /* Stack children vertically */
    align-items: center; /* Centers children vertically */
    justify-content: center; /* Centers children horizontally */
    margin: 10px;
  }
  /* Visually hide the radio input but keep it accessible */
  input[type='radio'] {
      margin: 0;
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
  }
  /* Style for the icon  */
  .material-icons {
    cursor: pointer;
    margin: 0;
    padding: 0;
  }
  /* Style for the icon when the radio button is selected */
  input[type="radio"]:checked + .material-icons {
    /* Styles to highlight the active state, e.g., change color or add a border */
    border: 1px solid var(--primary-color);
    color: var(--primary-color);
  }
</style>