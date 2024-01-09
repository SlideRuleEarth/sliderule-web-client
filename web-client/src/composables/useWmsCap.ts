import ol_control_WMSCapabilities from 'ol-ext/control/WMSCapabilities';

export function useWmsCap() {
    const cap = new ol_control_WMSCapabilities({
        srs: ['EPSG:2154'],
        cors: true,
        optional: 'token',
        services: {
            'BRGM': 'https://geoservices.brgm.fr/geologie',
            'OSM': 'https://wms.openstreetmap.fr/wms',
        },
        trace: true
    });
    return { cap };
}