<template>
  <div class="sr-radio-bb-card">
    <div class="sr-radio-bb-outer-container ">
      <label class="sr-radio-bb-cat-label" for="dynamic">{{ props.label }}</label>
      <div class="sr-radio-bb-container ">
          <div v-for="category in categories" :key="category.value" class="sr-radio-bb-menu">
              <RadioButton v-model="selectedCategory" :inputId="category.value" name="dynamic" :value="category.name" ariaLabel="ariaLabel"/>
              <label :for="category.value" class="sr-radio-bb-label">{{ category.name }}</label>
          </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import RadioButton from 'primevue/radiobutton';

export interface SrRadioBtnCategory {
  name: string;
  value: string;
}

const props = defineProps<{
  label: string;
  categories: SrRadioBtnCategory[];
}>()

const selectedCategory = ref(props.categories[0].name);

</script>

<style scoped>
  .sr-radio-bb-card {
    padding: 0.25rem 0rem 0rem 0rem; /* t r b l */
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin: 0rem 0rem 0rem 0rem;
    border-width: 1px;
    border-radius: var(--p-border-radius);
    border-style: solid;
    border-color: #424b57;
  }
  .sr-radio-bb-outer-container {
    margin: 0rem 0rem 0rem 1rem;
  }
  .sr-radio-bb-cat-label {
    margin: 1rem 0rem 0rem 0rem;
  }
  .sr-radio-bb-container {
    width: 100%;
    padding: 1rem 0rem 0rem 0rem;
    gap: 0.25rem 0.25rem; /* row col */ 
  }

  .sr-radio-bb-menu {
    display: flex;
    align-items: space-between;
    margin: 0.125rem 0 0 0.125rem;
  }
  .sr-radio-bb-label {
    margin: 0rem 0rem 0rem 1rem;/* t r b l */
  }

</style>