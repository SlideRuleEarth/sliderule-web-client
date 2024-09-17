<script setup lang="ts">

</script>

<template>
    <div class="sr-sidebar-header">
        <slot name = "sr-sidebar-header"></slot>
    </div>
    <div class="sr-sidebar-body">
        <slot name = "sr-sidebar-body"></slot>
    </div>
    <div class="sr-sidebar-footer">
        <slot name = "sr-sidebar-footer"></slot>
    </div>
</template>

<style scoped>
    .sr-sidebar-header, .sr-sidebar-body, .sr-sidebar-footer {
        box-sizing: border-box; /* Ensures padding and border are included in the total width/height */
    }

    .sr-sidebar-header {
        display: flex;
        justify-content: center;
        align-items: flex-start;
    }
    .sr-sidebar-body {
        display: flex;
        min-height: 80vh;
        min-width: 15vw;
        justify-content: center;
        align-items: flex-start;
    }
    .sr-sidebar-footer {
        display: flex;
        justify-content: right;
        align-items:flex-end;
        border-top: 2px solid var(--surface-d);
    }
</style>