<script setup>
  import SrBuildDate from '@/components/SrBuildDate.vue';
  import SrUserAgent from '@/components/SrUserAgent.vue';
</script>

<template>
  <div class="sr-about">
    <SrBuildDate />
    <SrUserAgent/>
  </div>
</template>

<style scoped>
@media (min-width: 1024px) {
  .sr-about {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
