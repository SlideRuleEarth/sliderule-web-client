<script setup>
import SingleColumnLayout from '@/layouts/SingleColumnLayout.vue';
import SrRecords from '@/components/SrRecords.vue';
</script>

<template>
  <SingleColumnLayout>
    <template v-slot:sr-single-col>
      <SrRecords />
    </template>
  </SingleColumnLayout>
</template>

<style scoped>

</style>
