<script setup lang="ts">
import { ref } from "vue";

// State to track the clearing process
const isClearing = ref(false);
const message = ref("");

const clearCacheAndReload = async () => {
  isClearing.value = true;
  message.value = "Clearing cache...";

  try {
    // Open cache storage and delete all caches
    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      console.log("Cache cleared.");
    } else {
      console.warn("Cache API not supported in this browser.");
    }

    // Force a hard reload (bypasses cache)
    message.value = "Reloading...";
    window.location.reload();
  } catch (error) {
    console.error("Error clearing cache:", error);
    message.value = "Failed to clear cache.";
  } finally {
    isClearing.value = false;
  }
};
</script>

<template>
  <div class="cache-reload">
    <button :disabled="isClearing" @click="clearCacheAndReload">
      {{ isClearing ? "Clearing..." : "Empty Cache & Hard Reload" }}
    </button>
    <p v-if="message">{{ message }}</p>
  </div>
</template>

<style scoped>
.cache-reload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
button {
  padding: 10px 15px;
  font-size: 16px;
  cursor: pointer;
  border: none;
  border-radius: 5px;
  background-color: #007bff;
  color: white;
}
button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
p {
  font-size: 14px;
  color: #666;
}
</style>
