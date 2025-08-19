// prjToEpsg.ts
import { srProjections } from '@/composables/SrProjections';

export function prjToSupportedEpsg(prjWkt: string | null): string | null {
    if (!prjWkt) return null;
    const w = prjWkt.toLowerCase();

    // 1) If EPSG is literally in the WKT
    const m = w.match(/epsg[:\s"]*([0-9]{3,6})/);
    if (m) {
        const epsg = `EPSG:${m[1]}`;
        return srProjections.value[epsg] ? epsg : null;
    }

    // 2) Pattern-match your known projections
    if (w.includes('stere') && w.includes('lat_0=90') && w.includes('lat_ts=70')) return 'EPSG:3413';
    if (w.includes('stere') && w.includes('lat_0=-90') && w.includes('lat_ts=-71')) return 'EPSG:3031';
    if (w.includes('stere') && w.includes('lat_0=90') && w.includes('lat_ts=90') && w.includes('lon_0=-150')) return 'EPSG:5936';

    // 3) Geographic WGS84
    if (w.includes('wgs_1984') && (w.includes('geographic') || w.includes('gcs_wgs_1984'))) return 'EPSG:4326';

    return null;
}
