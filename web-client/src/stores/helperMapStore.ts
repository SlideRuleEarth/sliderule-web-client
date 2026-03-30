import { defineStore } from 'pinia'
import type OLMap from 'ol/Map.js'
import type { Coordinate } from 'ol/coordinate'
import type { SrRegion } from '@/types/SrTypes'
import { area, polygon } from '@turf/turf'
import Graticule from 'ol/layer/Graticule.js'
import { Stroke, Fill, Text } from 'ol/style'
import TileLayer from 'ol/layer/Tile.js'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WmsCapControl = any

function createGraticuleLayer(): Graticule {
  const graticule = new Graticule({
    strokeStyle: new Stroke({
      color: 'rgba(255,120,0,0.9)',
      width: 2,
      lineDash: [0.5, 4]
    }),
    showLabels: true,
    visible: false,
    wrapX: false,
    lonLabelPosition: 0.1,
    latLabelPosition: 0.9,
    latLabelStyle: new Text({
      font: 'bold 12px Calibri,sans-serif',
      textAlign: 'end',
      fill: new Fill({ color: 'rgba(255,255,255,1)' }),
      stroke: new Stroke({ color: 'rgba(0,0,0,0.9)', width: 3 })
    }),
    lonLabelStyle: new Text({
      font: 'bold 12px Calibri,sans-serif',
      textBaseline: 'top',
      fill: new Fill({ color: 'rgba(255,255,255,1)' }),
      stroke: new Stroke({ color: 'rgba(0,0,0,0.9)', width: 3 })
    })
  })
  graticule.setProperties({ title: 'Graticule', name: 'Graticule' })
  return graticule
}

export const useHelperMapStore = defineStore('helperMap', {
  state: () => ({
    map: null as OLMap | null,
    poly: null as SrRegion | null,
    convexHull: null as SrRegion | null,
    areaOfConvexHull: 0 as number,
    areaOfPoly: 0 as number,
    polygonSource: null as 'polygon' | 'box' | 'upload' | null,
    polyCoords: [] as Coordinate[][],
    drawType: '' as string,
    selectedView: 'Global Mercator' as string,
    selectedBaseLayer: 'Esri World Topo' as string,
    copiedToClipboard: false as boolean,
    graticuleState: localStorage.getItem('helperGraticuleState') === 'true',
    graticules: new Map<OLMap, Graticule>(),
    extentToRestore: null as number[] | null,
    centerToRestore: null as number[] | null,
    zoomToRestore: null as number | null,
    wmsCapCache: new Map<string, WmsCapControl>(),
    currentWmsCapProjectionName: 'EPSG:3857' as string,
    layerCache: {} as Record<string, Map<string, TileLayer>>
  }),
  actions: {
    setMap(mapInstance: OLMap) {
      this.map = mapInstance
    },
    getMap() {
      return this.map
    },
    setPoly(poly: SrRegion) {
      this.poly = poly
      if (poly && poly.length >= 3) {
        try {
          const coords = poly.map((p) => [p.lon, p.lat])
          const first = coords[0]
          const last = coords[coords.length - 1]
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push([...first])
          }
          const turfPoly = polygon([coords])
          this.areaOfPoly = area(turfPoly) / 1e6 // km²
        } catch {
          this.areaOfPoly = 0
        }
      } else {
        this.areaOfPoly = 0
      }
    },
    setConvexHull(hull: SrRegion) {
      this.convexHull = hull
      if (hull && hull.length >= 3) {
        try {
          const coords = hull.map((p) => [p.lon, p.lat])
          const first = coords[0]
          const last = coords[coords.length - 1]
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push([...first])
          }
          const poly = polygon([coords])
          this.areaOfConvexHull = area(poly) / 1e6 // km²
        } catch {
          this.areaOfConvexHull = 0
        }
      } else {
        this.areaOfConvexHull = 0
      }
    },
    setPolygonSource(source: 'polygon' | 'box' | 'upload' | null) {
      this.polygonSource = source
    },
    getFormattedAreaOfConvexHull(): string {
      if (this.areaOfConvexHull < 1) {
        return `${(this.areaOfConvexHull * 1e6).toFixed(0)} m²`
      }
      return `${this.areaOfConvexHull.toFixed(this.areaOfConvexHull < 10 ? 2 : 1)} km²`
    },
    getFormattedArea(areaKm2: number): string {
      if (areaKm2 < 1) {
        return `${(areaKm2 * 1e6).toFixed(0)} m²`
      }
      return `${areaKm2.toFixed(areaKm2 < 10 ? 2 : 1)} km²`
    },
    clearPolygon() {
      this.poly = null
      this.convexHull = null
      this.areaOfConvexHull = 0
      this.areaOfPoly = 0
      this.polygonSource = null
      this.polyCoords = []
      this.copiedToClipboard = false
    },
    getPolygonAsApiRegion(): { lon: number; lat: number }[] | null {
      const source = this.poly
      if (!source || source.length === 0) return null

      const coords = source.map((p) => ({ lon: p.lon, lat: p.lat }))
      // Ensure closed
      const first = coords[0]
      const last = coords[coords.length - 1]
      if (first.lon !== last.lon || first.lat !== last.lat) {
        coords.push({ ...first })
      }
      return coords
    },
    getPolygonAsGeoJSON(): object | null {
      const coords = this.getPolygonAsApiRegion()
      if (!coords) return null

      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              name: 'SlideRule Helper Map Polygon',
              created: new Date().toISOString()
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coords.map((p) => [p.lon, p.lat])]
            }
          }
        ]
      }
    },
    getPolygonForClipboard(rasterize: boolean = false, cellSize: number = 0.01): string | null {
      if (rasterize) {
        // Rasterize ON: use raw polygon + region_mask (like the main request builder)
        const rawPoly = this.getPolygonAsApiRegion()
        if (!rawPoly) return null

        const rounded = rawPoly.map((p) => ({
          lon: Number(p.lon.toFixed(6)),
          lat: Number(p.lat.toFixed(6))
        }))
        // The API expects region_mask.geojson to be a JSON *string*, not a nested object
        const geoJsonObj = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: [rounded.map((p) => [p.lon, p.lat])]
              }
            }
          ]
        }
        const snippet: Record<string, any> = {
          poly: rounded,
          region_mask: {
            geojson: JSON.stringify(geoJsonObj),
            cellsize: cellSize
          }
        }
        return JSON.stringify(snippet, null, 2)
      } else {
        // Rasterize OFF: use convex hull (simplified)
        const hull = this.convexHull
        if (!hull || hull.length === 0) {
          // Fallback to raw poly if no hull (e.g. box)
          const rawPoly = this.getPolygonAsApiRegion()
          if (!rawPoly) return null
          const snippet = {
            poly: rawPoly.map((p) => ({
              lon: Number(p.lon.toFixed(6)),
              lat: Number(p.lat.toFixed(6))
            }))
          }
          return JSON.stringify(snippet, null, 2)
        }

        const coords = hull.map((p) => ({
          lon: Number(p.lon.toFixed(6)),
          lat: Number(p.lat.toFixed(6))
        }))
        // Ensure closed
        const first = coords[0]
        const last = coords[coords.length - 1]
        if (first.lon !== last.lon || first.lat !== last.lat) {
          coords.push({ ...first })
        }
        const snippet = { poly: coords }
        return JSON.stringify(snippet, null, 2)
      }
    },
    setDrawType(drawType: string) {
      this.drawType = drawType
    },
    getDrawType(): string {
      return this.drawType
    },
    setSelectedView(view: string) {
      this.selectedView = view
    },
    setSelectedBaseLayer(baseLayer: string) {
      this.selectedBaseLayer = baseLayer
    },
    toggleGraticule() {
      this.graticuleState = !this.graticuleState
      localStorage.setItem('helperGraticuleState', String(this.graticuleState))
      this.setGraticuleForMap()
    },
    setGraticuleState(state: boolean) {
      this.graticuleState = state
      localStorage.setItem('helperGraticuleState', String(state))
      this.setGraticuleForMap()
    },
    getOrCreateGraticule(map: OLMap): Graticule {
      let graticule = this.graticules.get(map)
      if (!graticule) {
        graticule = createGraticuleLayer()
        graticule.setZIndex(1000)
        graticule.setVisible(this.graticuleState)
        this.graticules.set(map, graticule)
      }
      return graticule as Graticule
    },
    recreateGraticuleForMap(map: OLMap) {
      const existing = this.graticules.get(map)
      if (existing) {
        map.removeLayer(existing as any)
        this.graticules.delete(map)
      }
      const newGraticule = this.getOrCreateGraticule(map)
      map.addLayer(newGraticule)
    },
    setGraticuleForMap(targetMap?: OLMap) {
      this.graticules.forEach((graticule, map) => {
        if (!targetMap || map === targetMap) {
          graticule.setVisible(this.graticuleState)
        }
      })
    },
    setExtentToRestore(extent: number[]) {
      this.extentToRestore = extent
    },
    setCenterToRestore(center: number[]) {
      this.centerToRestore = center
    },
    setZoomToRestore(zoom: number) {
      this.zoomToRestore = zoom
    },
    cacheWmsCapForProjection(projectionName: string, wmsCapInstance: WmsCapControl) {
      this.wmsCapCache.set(projectionName, wmsCapInstance)
    },
    getWmsCapFromCache(projectionName: string): WmsCapControl {
      return this.wmsCapCache.get(projectionName)!
    },
    setCurrentWmsCap(projectionName: string) {
      const wmsCap = this.getWmsCapFromCache(projectionName)
      if (wmsCap) {
        this.map?.addControl(wmsCap)
        this.currentWmsCapProjectionName = projectionName
      }
    },
    updateWmsCap(projectionName: string) {
      const currentWmsCap = this.wmsCapCache.get(this.currentWmsCapProjectionName)
      if (currentWmsCap) {
        this.map?.removeControl(currentWmsCap)
      }
      this.setCurrentWmsCap(projectionName)
    },
    resetMap() {
      this.selectedView = 'Global Mercator'
      this.drawType = ''
    }
  }
})
