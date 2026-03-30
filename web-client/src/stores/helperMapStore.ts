import { defineStore } from 'pinia'
import type OLMap from 'ol/Map.js'
import type { Coordinate } from 'ol/coordinate'
import type { SrRegion } from '@/types/SrTypes'
import { area, polygon } from '@turf/turf'

export const useHelperMapStore = defineStore('helperMap', {
  state: () => ({
    map: null as OLMap | null,
    poly: null as SrRegion | null,
    convexHull: null as SrRegion | null,
    areaOfConvexHull: 0 as number,
    polygonSource: null as 'polygon' | 'box' | 'upload' | null,
    polyCoords: [] as Coordinate[][],
    drawType: '' as string,
    selectedView: 'Global Mercator' as string,
    selectedBaseLayer: 'Esri World Topo' as string,
    copiedToClipboard: false as boolean
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
    clearPolygon() {
      this.poly = null
      this.convexHull = null
      this.areaOfConvexHull = 0
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
    resetMap() {
      this.selectedView = 'Global Mercator'
      this.drawType = ''
    }
  }
})
