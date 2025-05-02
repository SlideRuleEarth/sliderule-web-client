<script setup lang="ts">
</script>

<template>
  <div class="two-column-layout full-height">
    <div class="sidebar-col">
      <slot name="sidebar-col"></slot>
    </div>
    <main class="main-col">
      <slot name="main"></slot>
    </main>
  </div>
</template>

<style scoped>
.two-column-layout {
  display: flex;
  height: calc(var(--vh, 1vh) * 100);
}

/* Mobile-first: column layout on smaller screens */
@media screen and (min-device-width: 768px) and (max-device-width: 1024px) and (orientation: portrait) {
  .two-column-layout {
    flex-direction: column;
  }
}

.sidebar-col {
  flex-grow: 1;
  flex-basis: 25%;
  margin: 0; /* ✅ Remove horizontal margin */
  padding: 0; /* ✅ Remove horizontal padding */
  overflow-x: hidden; /* ✅ Prevent overflow */
  display: flex;
  flex-direction: column;
  align-items: stretch; /* ✅ Make children fill the width */
  min-width: 15rem;
}


/* Tweak sidebar for tablets and small laptops */
@media (max-width: 1024px) {
  .sidebar-col {
    min-width: 15rem;
  }
}

@media (max-width: 768px) {
  .sidebar-col {
    width: 100%;
    min-width: unset;
    margin: 0;
  }
}

.main-col {
  flex-grow: 8;
  overflow-y: auto;
}
</style>
