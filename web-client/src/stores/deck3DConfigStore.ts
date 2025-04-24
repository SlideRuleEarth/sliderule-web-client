import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Pinia store for Deck configuration parameters
 * (numbers and booleans extracted from DeckImpl options)
 */
export const useDeck3DConfigStore = defineStore('deckConfig', () => {
  // OrbitView parameters
  // - fovy: field of view (in degrees)
  const fovy = ref<number>(50);

  // Controller parameters
  const autoRotate = ref<boolean>(false);
  const inertia = ref<number>(0);
  const zoomSpeed = ref<number>(0.02);
  const rotateSpeed = ref<number>(0.3);
  const panSpeed = ref<number>(0.5);

  // Initial view state parameters
  const zoom = ref<number>(5);
  const rotationX = ref<number>(45);
  const rotationOrbit = ref<number>(30);

  // Debug flag
  const debug = ref<boolean>(true);

  return {
    fovy,
    autoRotate,
    inertia,
    zoomSpeed,
    rotateSpeed,
    panSpeed,
    zoom,
    rotationX,
    rotationOrbit,
    debug,
  };
});
