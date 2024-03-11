<template>
    <div class="sr-checkbox">
        <label> {{ label }} </label>
        <input type="checkbox" :checked="isChecked" @change="handleChange" />
    </div>
</template>

<script setup lang="ts">
import {computed} from 'vue';

const props = defineProps({
  label: String,
  store: Object, // The Pinia store
  propertyName: String // The name of the property in the store
});

// Creates a computed property bound to the store value
const isChecked = computed({
  get: () => {
    if (props.store && props.propertyName !== undefined) {
      return props.store[props.propertyName]; // TypeScript now knows propertyName cannot be undefined
    }
    return false; // Provide a default fallback
  },
  set: (value) => {
    if (props.store && props.propertyName !== undefined) {
      props.store.$patch({ [props.propertyName]: value });
    }
  }
});

function handleChange(event) {
  isChecked.value = event.target.checked;
}
</script>

<style scoped>
.sr-checkbox {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
</style>
