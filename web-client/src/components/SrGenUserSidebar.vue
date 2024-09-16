<script setup lang="ts">
    import SrRunControl from "@/components/SrRunControl.vue";
    import SrGenUserSidebarOptions from "@/components/SrGenUserOptions.vue";
</script>

<template>
    <div class="sr-gen-user-sidebar-container">
        <SrRunControl />
        <SrGenUserSidebarOptions />
    </div>
</template>

<style scoped>
    .sr-gen-user-sidebar-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        height: 100%;
        overflow-y: auto;
        width: 100%;
    }

</style>