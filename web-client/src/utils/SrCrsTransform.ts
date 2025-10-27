import proj4 from 'proj4';
import { srProjections } from '@/composables/SrProjections';
import { createLogger } from '@/utils/logger';

const logger = createLogger('SrCrsTransform');

// Target CRS for all map display (per GeoParquet spec default)
const TARGET_CRS = 'EPSG:4326'; // WGS 84

/**
 * Extract CRS identifier from GeoParquet metadata
 * Following the GeoParquet specification v1.0.0
 *
 * @param geoMetadata - Parsed geo metadata from parquet file
 * @returns CRS code (e.g., "EPSG:7912") or null if not found/not transformable
 */
export function extractCrsFromGeoMetadata(geoMetadata: any): string | null {
    if (!geoMetadata?.columns) {
        return null;
    }

    // Get the primary geometry column (default to 'geometry')
    const primaryColumn = geoMetadata.primary_column || 'geometry';
    const columnMetadata = geoMetadata.columns[primaryColumn];

    if (!columnMetadata?.crs) {
        // Per GeoParquet spec: if no CRS specified, default is OGC:CRS84 (equivalent to EPSG:4326)
        logger.debug('extractCrsFromGeoMetadata: No CRS found, assuming OGC:CRS84/EPSG:4326');
        return 'EPSG:4326';
    }

    const crs = columnMetadata.crs;

    // Try to extract EPSG code from id.authority and id.code
    if (crs.id?.authority && crs.id?.code) {
        const crsCode = `${crs.id.authority}:${crs.id.code}`;
        logger.debug('extractCrsFromGeoMetadata: Found CRS from id', { crsCode });
        return crsCode;
    }

    // Check if it's a compound CRS with components array (PROJJSON format)
    // Extract the horizontal/geographic component for 2D map display
    if (crs.type === 'CompoundCRS' && Array.isArray(crs.components)) {
        logger.debug('extractCrsFromGeoMetadata: Found CompoundCRS with components', { componentsLength: crs.components.length });

        // Find the geographic/horizontal component (usually first)
        const horizontalComponent = crs.components.find((comp: any) =>
            comp.type === 'GeographicCRS' ||
            comp.type === 'ProjectedCRS' ||
            comp.type === 'GeodeticCRS'
        );

        if (horizontalComponent) {
            logger.debug('extractCrsFromGeoMetadata: Found horizontal component', { type: horizontalComponent.type, name: horizontalComponent.name, id: horizontalComponent.id });

            if (horizontalComponent.id?.authority && horizontalComponent.id?.code) {
                const horizontalCrsCode = `${horizontalComponent.id.authority}:${horizontalComponent.id.code}`;
                logger.debug('extractCrsFromGeoMetadata: Extracted horizontal CRS from compound', { horizontalCrsCode });
                return horizontalCrsCode;
            } else {
                logger.warn('extractCrsFromGeoMetadata: Horizontal component found but missing id.authority or id.code');
            }
        } else {
            logger.warn('extractCrsFromGeoMetadata: CompoundCRS has components but no Geographic/Projected/Geodetic component found');
        }
    }

    // Check if it's a compound CRS (older format with base_crs)
    // Extract the horizontal base CRS for 2D map display
    if (crs.base_crs?.id?.authority && crs.base_crs.id?.code) {
        const baseCrsCode = `${crs.base_crs.id.authority}:${crs.base_crs.id.code}`;
        logger.debug('extractCrsFromGeoMetadata: Found compound CRS, using horizontal base CRS', { baseCrsCode });
        return baseCrsCode;
    }

    // For compound CRS without base_crs.id, try to extract from datum
    if (crs.base_crs?.datum?.id?.authority && crs.base_crs.datum.id?.code) {
        const datumCode = `${crs.base_crs.datum.id.authority}:${crs.base_crs.datum.id.code}`;
        logger.debug('extractCrsFromGeoMetadata: Using datum from compound CRS base', { datumCode });
        return datumCode;
    }

    // Check if it's a geographic CRS with a datum (fallback for non-compound)
    if (crs.datum?.id?.authority && crs.datum?.id?.code) {
        const datumCode = `${crs.datum.id.authority}:${crs.datum.id.code}`;
        logger.debug('extractCrsFromGeoMetadata: Found CRS from datum', { datumCode });
        return datumCode;
    }

    // If we only have a CRS name but it's not a valid proj4 identifier
    if (crs.name) {
        logger.warn('extractCrsFromGeoMetadata: CRS name found but not parseable as proj4 code', { crsName: crs.name });
        logger.warn('extractCrsFromGeoMetadata: Skipping transformation - assuming coordinates are WGS 84 compatible');
        logger.debug('extractCrsFromGeoMetadata: Full CRS object for debugging', { crs: JSON.stringify(crs, null, 2) });
        // Return null to skip transformation (treat as if already in WGS 84)
        return null;
    }

    logger.warn('extractCrsFromGeoMetadata: Could not extract CRS identifier');
    return null;
}

/**
 * Register a CRS with proj4 if not already registered
 *
 * @param crsCode - CRS code (e.g., "EPSG:7912")
 */
function ensureCrsRegistered(crsCode: string): void {
    // Check if already defined in proj4
    if (proj4.defs(crsCode)) {
        return;
    }

    // Check if we have it in our srProjections
    const projection = srProjections.value[crsCode];
    if (projection?.proj4def) {
        logger.debug('Registering CRS with proj4', { crsCode });
        proj4.defs(crsCode, projection.proj4def);
        return;
    }

    logger.warn('CRS not found in srProjections and not registered with proj4', { crsCode });
}

/**
 * Transform a coordinate from source CRS to WGS 84 (EPSG:4326)
 *
 * @param lon - Longitude in source CRS
 * @param lat - Latitude in source CRS
 * @param sourceCrs - Source CRS code (e.g., "EPSG:7912")
 * @returns Transformed [longitude, latitude] in EPSG:4326, or original if transformation fails
 */
export function transformCoordinate(
    lon: number,
    lat: number,
    sourceCrs: string | null
): [number, number] {
    // If no source CRS or already in target CRS, return as-is
    if (!sourceCrs || sourceCrs === TARGET_CRS || sourceCrs === 'EPSG:4326' || sourceCrs === 'OGC:CRS84') {
        return [lon, lat];
    }

    try {
        // Ensure both CRSs are registered
        ensureCrsRegistered(sourceCrs);
        ensureCrsRegistered(TARGET_CRS);

        // Perform transformation
        const transformed = proj4(sourceCrs, TARGET_CRS, [lon, lat]);
        return [transformed[0], transformed[1]];
    } catch (error) {
        logger.error('transformCoordinate: Failed to transform', { sourceCrs, targetCrs: TARGET_CRS, error: error instanceof Error ? error.message : String(error) });
        logger.warn('transformCoordinate: Returning original coordinates without transformation');
        return [lon, lat];
    }
}

/**
 * Transform multiple coordinates in batch
 *
 * @param coordinates - Array of [lon, lat] pairs
 * @param sourceCrs - Source CRS code
 * @returns Array of transformed [lon, lat] pairs in EPSG:4326
 */
export function transformCoordinates(
    coordinates: Array<[number, number]>,
    sourceCrs: string | null
): Array<[number, number]> {
    // If no transformation needed, return as-is
    if (!sourceCrs || sourceCrs === TARGET_CRS || sourceCrs === 'EPSG:4326' || sourceCrs === 'OGC:CRS84') {
        return coordinates;
    }

    return coordinates.map(([lon, lat]) => transformCoordinate(lon, lat, sourceCrs));
}

/**
 * Get human-readable CRS name
 *
 * @param crsCode - CRS code (e.g., "EPSG:7912")
 * @returns Human-readable name (e.g., "ITRF2014")
 */
export function getCrsName(crsCode: string | null): string {
    if (!crsCode) {
        return 'Unknown';
    }

    const projection = srProjections.value[crsCode];
    if (projection?.title) {
        return projection.title;
    }

    return crsCode;
}

/**
 * Check if coordinates need transformation
 *
 * @param sourceCrs - Source CRS code
 * @returns true if transformation is needed
 */
export function needsTransformation(sourceCrs: string | null): boolean {
    if (!sourceCrs) {
        return false;
    }
    return sourceCrs !== TARGET_CRS && sourceCrs !== 'EPSG:4326' && sourceCrs !== 'OGC:CRS84';
}
