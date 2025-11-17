import {
  Deck,
  MapView,
  OrthographicView,
  type MapViewState,
  type OrthographicViewState
} from '@deck.gl/core'
import type OLMap from 'ol/Map.js'
import type { Projection } from 'ol/proj'
import { toLonLat } from 'ol/proj'
import { Layer as OLlayer } from 'ol/layer'
import { useDeckStore } from '@/stores/deckStore'
import { requiresOrthographicDeck } from '@/utils/SrMapUtils'
import { OL_DECK_LAYER_NAME } from '@/types/SrTypes'

type Logger = {
  debug: (_message: string, _payload?: Record<string, unknown>) => void
  warn: (_message: string, _payload?: Record<string, unknown>) => void
  error: (_message: string, _payload?: Record<string, unknown>) => void
}

type MapDeckOverlayOptions = {
  deckViewId: string
  getLogger: () => Logger
  getMap: () => OLMap | undefined
}

type OlLayerRenderState = {
  size: number[]
  viewState: { center: number[]; zoom: number; rotation: number; resolution?: number }
}

export function useMapDeckOverlay(options: MapDeckOverlayOptions) {
  const deckStore = useDeckStore()

  function createDeckInstance(map: OLMap) {
    const logger = options.getLogger()
    const mapView = map.getView()
    const projectionCode = mapView.getProjection().getCode()
    const useOrthographic = projectionCode ? requiresOrthographicDeck(projectionCode) : false
    const target = map.getViewport() as HTMLDivElement
    const initialViewState = useOrthographic
      ? ({
          [options.deckViewId]: {
            target: [0, 0, 0] as [number, number, number],
            zoom: 0
          }
        } satisfies Record<string, OrthographicViewState>)
      : ({
          [options.deckViewId]: {
            longitude: 0,
            latitude: 0,
            zoom: 1
          }
        } satisfies Record<string, MapViewState>)

    const deck = new Deck({
      initialViewState,
      controller: false,
      parent: target,
      style: { pointerEvents: 'none', zIndex: '1' },
      layers: [],
      getCursor: () => 'default',
      useDevicePixels: false,
      views: [
        useOrthographic
          ? new OrthographicView({ id: options.deckViewId, flipY: false })
          : new MapView({ id: options.deckViewId })
      ]
    })

    deckStore.setViewMode(useOrthographic ? 'orthographic' : 'map')
    deckStore.setDeckInstance(deck)
    logger.debug('createDeckInstance end')
  }

  function createOLLayerForDeck(
    deck: Deck<any> | null,
    projectionUnits: string,
    projection: Projection
  ): OLlayer {
    const logger = options.getLogger()

    const layerOptions = {
      title: OL_DECK_LAYER_NAME
    }

    const render = ({ size, viewState }: OlLayerRenderState) => {
      const [width, height] = size
      if (!deck) {
        return document.createElement('div')
      }

      if (deckStore.isOrthographicMode()) {
        const center = viewState.center
        const resolution = viewState.resolution ?? options.getMap()?.getView().getResolution()
        if (!center || center.some((val) => !Number.isFinite(val))) {
          logger.warn('Invalid orthographic center for deck view', { center })
          return document.createElement('div')
        }
        if (!resolution || !Number.isFinite(resolution) || resolution <= 0) {
          logger.warn('Invalid resolution for orthographic deck view', { resolution })
          return document.createElement('div')
        }
        const zoom = Math.log2(1 / resolution)
        const deckViewState: OrthographicViewState = {
          target: [center[0], center[1], 0] as [number, number, number],
          zoom
        }
        requestAnimationFrame(() => {
          deck.setProps({ width, height, viewState: deckViewState })
          deck.redraw()
        })
        return document.createElement('div')
      }

      let [longitude, latitude] = viewState.center
      if (projectionUnits !== 'degrees') {
        try {
          ;[longitude, latitude] = toLonLat(viewState.center, projection)
        } catch (error) {
          logger.warn('Failed to transform coordinates - likely outside projection extent', {
            originalCenter: viewState.center,
            projectionUnits,
            zoom: viewState.zoom,
            error: error instanceof Error ? error.message : String(error)
          })
          return document.createElement('div')
        }
      }

      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        logger.warn('Invalid deck.gl view state coordinates', {
          longitude,
          latitude,
          originalCenter: viewState.center,
          projectionUnits
        })
        return document.createElement('div')
      }

      const bearing = (-viewState.rotation * 180) / Math.PI
      const deckViewState: MapViewState = {
        bearing,
        longitude,
        latitude,
        zoom: viewState.zoom - 1
      }

      requestAnimationFrame(() => {
        deck.setProps({ width, height, viewState: deckViewState })
        deck.redraw()
      })

      return document.createElement('div')
    }

    return new OLlayer({
      render,
      ...layerOptions
    })
  }

  function addDeckLayerToMap(map: OLMap) {
    const mapView = map.getView()
    const projection = mapView.getProjection()
    const projectionUnits = projection.getUnits()
    const logger = options.getLogger()

    const center = mapView.getCenter()
    if (!center || center.some((val) => !Number.isFinite(val))) {
      logger.error('addDeckLayerToMap: Invalid view center, cannot create deck layer', {
        center,
        projection: projection.getCode()
      })
      return
    }

    const updatingLayer = map
      .getLayers()
      .getArray()
      .find((layer) => layer.get('title') === OL_DECK_LAYER_NAME)
    if (updatingLayer) {
      map.removeLayer(updatingLayer)
    }

    const deckInstance = deckStore.getDeckInstance() as Deck<any> | null
    const deckLayer = createOLLayerForDeck(deckInstance, projectionUnits, projection)
    map.addLayer(deckLayer)
  }

  return {
    createDeckInstance,
    addDeckLayerToMap
  }
}
