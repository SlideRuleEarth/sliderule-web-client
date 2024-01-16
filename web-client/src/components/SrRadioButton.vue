<template>
    <label class="radio-button-label">
      <input
        type="radio"
        :value="value"
        :checked="isChecked"
        @change="handleChange"
        class="radio-input"
      >
      <span v-html="icon" class="icon-svg"></span>
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
    console.log(event);
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
    margin: 1px;
    display: flex; /* Aligns children (input and icon) in a row */
    flex-direction: column; /* Stack children vertically */
    align-items: center; /* Centers children vertically */
    justify-content: center; /* Centers children horizontally */
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
  .icon-svg {
    margin: 2px;
    display: flex; /* or other display types as needed */
    align-items: center; /* Centers children vertically */
    justify-content: center; /* Centers children horizontally */
    width: 1.6em; /* Adjust as needed */
    height: 1.6em; /* Adjust as needed */
  }
  /* Style for the icon when the radio button is selected */

</style>