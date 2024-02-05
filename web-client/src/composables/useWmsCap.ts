import ol_control_WMSCapabilities from 'ol-ext/control/WMSCapabilities';
import { useProjectionNames } from '@/composables/SrProjections';

export function useWmsCap() {
    const projectionNames = useProjectionNames().value; // Access computed property value

    const wms_capabilities_cntrl= new ol_control_WMSCapabilities({
        srs: projectionNames,
        cors: false,
        optional: 'token',
        services: {
            'Nasa GIBS': 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?',
            'Nasa Blue Marble': 'https://worldwind25.arc.nasa.gov/wms',
            'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wms/wms',
        },
        trace: true
    });
    return { wms_capabilities_cntrl};
}
