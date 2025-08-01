declare module 'shpjs' {
    export default function shp(
        input: Record<string, ArrayBuffer> | ArrayBuffer | string
    ): Promise<GeoJSON.FeatureCollection>;

    // Optional: Add other types if needed
}
