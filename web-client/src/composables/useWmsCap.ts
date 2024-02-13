import ol_control_WMSCapabilities from 'ol-ext/control/WMSCapabilities';
import { useMapStore } from '@/stores/mapStore';
import Permalink from "ol-ext/control/Permalink";
import BaseEvent from "ol/events/Event";

const mapStore = useMapStore();

function isLocalStorageAvailable() {
    try {
        const test = "__test__";
        window.localStorage.setItem(test, test);
        window.localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

export function useWmsCap(projectionName: string) {
    console.log("useWmsCap:projectionName",projectionName);
    let services = {};
    if (projectionName === 'EPSG:3857') {
        services = {
            'Nasa GIBS Global (3857)': 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?',
            'Nasa Blue Marble': 'https://worldwind25.arc.nasa.gov/wms',
            'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wms/wms',
        }
    } else if (projectionName === 'EPSG:4326') {
        services = {
            'Nasa GIBS Global (4326)': 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?',
            'Nasa Blue Marble': 'https://worldwind25.arc.nasa.gov/wms',
            'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wms/wms',
        }
    } else if (projectionName === 'EPSG:5936') {
        services = {
            'Nasa GIBS Sea Ice Polar North (3413)': 'https://gibs.earthdata.nasa.gov/wms/epsg3413/best/wms.cgi?',
            'Nasa Blue Marble': 'https://worldwind25.arc.nasa.gov/wms',
            'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wms/wms',
        }
    }
    else if (projectionName === 'EPSG:3031') {
        services = {
            'Nasa GIBS Antartic Polar South (3031)': 'https://gibs.earthdata.nasa.gov/wms/epsg3031/best/wms.cgi?',
            'Nasa Blue Marble': 'https://worldwind25.arc.nasa.gov/wms',
            'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wms/wms',
        }
    }
    const map = mapStore.getMap();
    if(map){
        const wms_capabilities_cntrl= new ol_control_WMSCapabilities({
            srs: [`${projectionName}`],
            cors: false,
            optional: 'token',
            services: services,
            trace: true
        });

        if(wms_capabilities_cntrl){
            map.addControl(wms_capabilities_cntrl);
            let plink: Permalink;
            if (isLocalStorageAvailable()) {
                plink = new Permalink({ visible: true, localStorage: 'position' });
                map.addControl(plink);
            } else {
                console.log("Error:localStorage not available no Permalink control added");
            }
            const et:any = 'load';
            wms_capabilities_cntrl.on(et,(event: BaseEvent) => {
                const e = event as any;
                map.addLayer(e.layer);
                e.layer.set('legend', e.options.data.legend);
                plink.setUrlParam('url', e.options.source.url);
                plink.setUrlParam('layer', e.options.source.params.LAYERS);
            });
            return wms_capabilities_cntrl;
        } else {
            console.log("Error:wms_capabilities_cntrl is null");
        }
    } else {
        console.log("Error:map is null");
    }
}
