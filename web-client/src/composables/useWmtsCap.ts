import ol_control_WMTSCapabilities from 'ol-ext/control/WMTSCapabilities';
import { useMapStore } from '@/stores/mapStore';
import BaseEvent from "ol/events/Event";

const mapStore = useMapStore();

export function useWmtsCap(projectionName: string) {
    console.log("useWmtsCap:projectionName",projectionName);
    let services = {};
    if (projectionName === 'EPSG:3857') {
        services = {
            'Nasa Blue Marble': 'https://worldwind25.arc.nasa.gov/wmts',
            'Nasa GIBS Global (3857)': 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?',
            //'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wmts/wmts',
        }
    } else if (projectionName === 'EPSG:4326') {
        services = {
            'Nasa Blue Marble': 'https://worldwind25.arc.nasa.gov/wmts',
            'Nasa GIBS Global (4326)': 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi?',
            //'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wmts/wmts',
        }
    } else if (projectionName === 'EPSG:5936') {
        services = {
            //'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wmts/wmts',
        }
    } else if (projectionName === 'EPSG:3413') {
        services = {
            'Nasa GIBS Sea Ice Polar North (3413)': 'https://gibs.earthdata.nasa.gov/wmts/epsg3413/best/wmts.cgi?',
            //'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wmts/wmts',
        }
    } else if (projectionName === 'EPSG:3031') {
        services = {
            'Nasa GIBS Antartic Polar South (3031)': 'https://gibs.earthdata.nasa.gov/wmts/epsg3031/best/wmts.cgi?',
            //'Nasa Earth Observations': 'https://neo.gsfc.nasa.gov/wmts/wmts',
        }
    } else {
        console.log(`Warn: No Services found for projectionName:${projectionName}`);
    }
    const map = mapStore.getMap();
    if(map){
        const title = `Web Map Tile Services (WMTS) for ${projectionName}`;
        const wmts_capabilities_cntrl= new ol_control_WMTSCapabilities({
            title: title,
            //target: 'wmts-capabilities',
            srs: [`${projectionName}`],
            cors: true,
            services: services,
            trace: true
        });
        const plink = mapStore.plink;
        if(plink){
            if(wmts_capabilities_cntrl){
                const et:any = 'load';
                wmts_capabilities_cntrl.on(et,(event: BaseEvent) => {
                    const e = event as any;
                    console.log('wmts_capabilities_cntrl:on:load', e);
                    map.addLayer(e.layer);
                    e.layer.set('legend', e.options.data.legend);
                    plink.setUrlParam('url', e.options.source.url);
                    plink.setUrlParam('layer', e.options.source.params.LAYERS);
                });
                return wmts_capabilities_cntrl;
            } else {
                console.log("Error:wmts_capabilities_cntrl is null");
            }
        } else {
            console.log("Error:plink is null");
        }
    } else {
        console.log("Error:map is null");
    }
}
