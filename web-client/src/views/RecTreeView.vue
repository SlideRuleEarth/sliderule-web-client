<script setup>
import SingleColumnLayout from '@/layouts/SingleColumnLayout.vue';
import SrRecTree from '@/components/SrRecTree.vue';
</script>

<template>
  <SingleColumnLayout>
    <template v-slot:sr-single-col>
      <SrRecTree />
    </template>
  </SingleColumnLayout>
</template>

<style scoped>

</style>
