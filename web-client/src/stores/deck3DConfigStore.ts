// stores/deck3DConfigStore.ts
import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { OrbitViewState } from '@deck.gl/core'

export const useDeck3DConfigStore = defineStore('deckConfig', () => {

  const deckContainer = ref<HTMLDivElement | null>(null);


  // — STATIC CONFIGURATION —
  const fovy        = ref(50)
  const orbitAxis   = ref<'Z'|'Y'>('Z')
  const inertia     = ref(0)
  const zoomSpeed   = ref(0.02)
  const rotateSpeed = ref(0.3)
  const panSpeed    = ref(0.5)
  const scale       = ref(100)
  const centroid    = ref<[number,number,number]>([scale.value/2,scale.value/2,scale.value/2])
  const debug       = ref(false)
  const fitZoom     = ref<number>(0.0)
  const showAxes    = ref(false);
  const pointSize   = ref(1.0);
  const minColorPercent = ref(2);
  const maxColorPercent = ref(98);
  const elDataRange      = ref<[number,number]>([0, 100]);
  const elScaleRange      = ref<[number,number]>([1, 99]);
  const verticalExaggeration = ref(1.0);  // default no exaggeration
  const verticalScaleRatio = ref(1.0); // default scale ratio
  // — LIVE VIEW STATE —
  // these will be updated in onViewStateChange
  const viewState = reactive<OrbitViewState>({
    target: [ ...centroid.value ],
    zoom:        5,
    rotationX:  45,
    rotationOrbit: 30
  })

  function updateViewState(vs: OrbitViewState) {
    viewState.zoom           = vs.zoom
    viewState.rotationX      = vs.rotationX!
    viewState.rotationOrbit  = vs.rotationOrbit!
    viewState.target         = [ ...vs.target! ]
  }

  return {
    // static
    fovy, orbitAxis,
    inertia, zoomSpeed, rotateSpeed, panSpeed,
    scale, centroid,
    fitZoom,
    debug,
    showAxes,
    // dynamic
    viewState,
    deckContainer,
    pointSize,
    minColorPercent,
    maxColorPercent,
    elScaleRange,
    elDataRange,
    verticalExaggeration,
    verticalScaleRatio,
    // methods
    updateViewState,
  }
})
