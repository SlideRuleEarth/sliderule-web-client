<script setup lang="ts">
import SrSideBar from "@/components/SrSideBar.vue";
import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
import SrMap from "@/components/SrMap.vue";
</script>

<template>
    <div class="general-user">
        <TwoColumnLayout>
            <template v-slot:header>
                <SrSideBar />
            </template>
            <template v-slot:main>
                <SrMap />
            </template>
        </TwoColumnLayout>
    </div>
</template>