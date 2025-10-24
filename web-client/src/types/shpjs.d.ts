declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson'

  export default function shp(
    _input: Record<string, ArrayBuffer> | ArrayBuffer | string
  ): Promise<FeatureCollection>

  // Optional: Add other types if needed
}
