<script setup>
import SingleColumnLayout from '@/layouts/SingleColumnLayout.vue';
</script>

<template>
  <div class="sr-popular">
    <SingleColumnLayout>
      <template v-slot:sr-single-col>
        <h1>PopularView</h1>
      </template>
    </SingleColumnLayout>
  </div>
  
</template>

<style scoped>
  .sr-popular {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
</style>
