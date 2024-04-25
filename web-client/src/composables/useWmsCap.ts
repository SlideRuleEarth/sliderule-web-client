import ol_control_WMSCapabilities from 'ol-ext/control/WMSCapabilities';
import { useMapStore } from '@/stores/mapStore';
import BaseEvent from "ol/events/Event";

const mapStore = useMapStore();

export function useWmsCap(projectionName: string) {
    //console.log("useWmsCap:projectionName",projectionName);
    let services = {};
    if (projectionName === 'EPSG:3857') {
        services = {
            'Nasa Blue Marble': 'https://worldwind25.arc.nasa.gov/wms',
            'Nasa GIBS Global (3857)': 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?',
            'USGS':'https://elevation.nationalmap.gov/arcgis/services/3DEPElevation/ImageServer/WMSServer?',
            'GLIMS': 'https://www.glims.org/geoserver/GLIMS/wms',
            //'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wms/wms',
        }
    } else if (projectionName === 'EPSG:4326') {
        services = {
            'Nasa Blue Marble': 'https://worldwind25.arc.nasa.gov/wms',
            'Nasa GIBS Global (4326)': 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?',
            //'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wms/wms',
        }
    } else if (projectionName === 'EPSG:5936') {
        services = {
            //'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wms/wms',
        }
    } else if (projectionName === 'EPSG:3413') {
        services = {
            'Nasa GIBS Sea Ice Polar North (3413)': 'https://gibs.earthdata.nasa.gov/wms/epsg3413/best/wms.cgi?',
            //'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wms/wms',
        }
    } else if (projectionName === 'EPSG:3031') {
        services = {
            'Nasa GIBS Antartic Polar South (3031)': 'https://gibs.earthdata.nasa.gov/wms/epsg3031/best/wms.cgi?',
            //'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wms/wms',
            'USGS Antartica': 'https://nimbus.cr.usgs.gov/arcgis/services/Antarctica/USGS_EROS_Antarctica_Reference/MapServer/WmsServer'
        }
    } else {
        console.log(`Warn: No Services found for projectionName:${projectionName}`);
    }
    const map = mapStore.getMap();
    if(map){
        const title = `Web Map Services (WMS) for ${projectionName}`;
        const wms_capabilities_cntrl= new ol_control_WMSCapabilities({
            title: title,
            srs: [`${projectionName}`],
            cors: true,
            //optional: 'token',
            services: services,
            trace: true
        });
        const plink = mapStore.plink;
        if(plink){
            if(wms_capabilities_cntrl){
                const et:any = 'load';
                wms_capabilities_cntrl.on(et,(event: BaseEvent) => {
                    const e = event as any;
                    console.log('wms_capabilities_cntrl:on:load', e);
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
            console.log("Error:plink is null");
        }
    } else {
        console.log("Error:map is null");
    }
}
