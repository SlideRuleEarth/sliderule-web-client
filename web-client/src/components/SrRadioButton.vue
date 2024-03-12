<template>
    <label class="radio-button-label" :title="tooltipText">
      <input
        type="radio"
        :value="value"
        :checked="isChecked"
        @change="handleChange"
        class="radio-input"
        :name="tooltipText"
        :aria-label="ariaLabel"
      >
      <!-- If icon is present, render it -->
      <span v-if="icon" v-html="icon" class="icon-svg" name="icon-svg"></span>
      <!-- If icon is not present, display value instead -->
      <span v-else class="icon-svg">{{ value }}</span>
    </label>
</template>
  
<script setup lang="ts">
import { computed } from 'vue';
  const props = withDefaults(
    defineProps<{
      name: string
      class: string
      value?: string
      modelValue?: string
      icon?: string
      ariaLabel?: string
      tooltipText?: string 
    }>(),
    {
      name: '',
      class: '',
      value: undefined,
      modelValue: '',
      icon: '',
      ariaLabel: '',
      tooltipText: '',
    },
  );
  
  //console.log("SrRadioButton.vue tooltipText:", props.tooltipText);
  const emit = defineEmits(['update:modelValue']);

  const isChecked = computed(() => {
    return props.modelValue === props.value;
  });

  const handleChange = (event: Event) => {
    //console.log(event);
    //console.log(event.type);
    try{
      const target = event.target as HTMLInputElement;
      if (target) {
        console.log(target);
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