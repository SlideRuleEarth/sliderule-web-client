<template>
  <Teleport to="body">
    <div
      class="feature-menu-overlay"
      v-if="visible"
      :style="menuStyle"
      @mousedown.stop
      @click.stop
    >
    <div
      v-for="(feature, index) in menuData as Feature<Geometry>[]"
        :key="index"
        class="feature-menu-item"
        @click="handleSelect(feature)"
    >
      {{ feature.get('name') || feature.getId() || `Feature ${index + 1}` }}
    </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Feature } from 'ol';
import type Geometry from 'ol/geom/Geometry';

const menuData = ref<Feature<Geometry>[]>([]); // use a strongly typed array
// Internal state
const visible = ref(false);
const menuStyle = ref<Record<string, string>>({});


// Define Emits
const emit = defineEmits<{
  (e: 'select', feature: Feature<Geometry>): void
}>();

// Public methods
const showMenu = (x: number, y: number, features: Feature<Geometry>[]) => {
  visible.value = true;
  menuData.value = features;

  const menuWidth = 220;
  const menuHeight = 160;

  let left = x;
  let top = y;

  const ww = window.innerWidth;
  const wh = window.innerHeight;
  if (left + menuWidth > ww) left = ww - menuWidth - 8;
  if (top + menuHeight > wh) top = wh - menuHeight - 8;
  left = Math.max(0, left);
  top = Math.max(0, top);

  menuStyle.value = {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    zIndex: '1200',
    background: '#222',
    borderRadius: '6px',
    boxShadow: '0 3px 18px rgba(0,0,0,0.3)',
    padding: '8px 0',
    minWidth: '180px',
  };
};

const hideMenu = () => {
  visible.value = false;
};

// Emit selected feature
function handleSelect(feature: Feature<Geometry>) {
  emit('select', feature);
  hideMenu();
}

// Expose API
defineExpose({ showMenu, hideMenu, menuData });
</script>

<style scoped>
.feature-menu-overlay {
  color: #fff;
  font-size: 1rem;
  user-select: none;
  max-width: 280px;
}

.feature-menu-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  white-space: nowrap;
}

.feature-menu-item:hover {
  background-color: #444;
}
</style>
