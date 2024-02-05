import ol_control_WMSCapabilities from 'ol-ext/control/WMSCapabilities';

export function useWmsCap() {
    const wms_capabilities_cntrl= new ol_control_WMSCapabilities({
        srs: ['EPSG:2154'],
        cors: false,
        optional: 'token',
        services: {
            'Nasa GIBS': 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?',
            'Nasa World View': 'https://worldview.earthdata.nasa.gov/wms',
            'Nasa WorldWind': 'https://worldwind25.arc.nasa.gov/wms',
            'USGS': 'https://www.opengis.net/wms',
        },
        trace: true
    });
    return { wms_capabilities_cntrl};
}
