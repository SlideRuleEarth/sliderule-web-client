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
    border-radius: 5px; /* Rounded corners */
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2); /* Slight shadow */
    transition: background-color 0.3s ease, transform 0.1s ease, box-shadow 0.1s ease;
    cursor: pointer; /* Change cursor to pointer on hover */
  }

  /* When the button is hovered, change background and "depress" it */
  .radio-button-label:hover {
    background-color:rgba(60, 60, 60, 1); /* Change color on hover */
    transform: translateY(2px); /* Slight downward movement to simulate press */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* Reduce shadow to enhance the pressed look */
  }

  /* Simulate button being pressed when active (on click) */
  .radio-button-label:active {
    transform: translateY(4px); /* Further downward movement when clicked */
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); /* Even smaller shadow */
    background-color: #A9A9A9; /* Darker grey to simulate pressed state */
    transform: translateY(2px); /* Slight downward movement to simulate press */
  }

  /* Visually hide the radio input but keep it accessible */
  input[type='radio'] {
    margin: 0;
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  /* Style for the icon */
  .icon-svg {
    margin: 2px;
    display: flex; /* or other display types as needed */
    align-items: center; /* Centers children vertically */
    justify-content: center; /* Centers children horizontally */
    width: 1.6em; /* Adjust as needed */
    height: 1.6em; /* Adjust as needed */
  }
</style>
