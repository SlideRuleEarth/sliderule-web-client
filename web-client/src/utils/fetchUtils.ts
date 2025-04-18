import { db } from '@/db/SlideRuleDb'
import { useSysConfigStore } from '@/stores/sysConfigStore';
import { useJwtStore } from '@/stores/SrJWTStore';
import { Buffer } from 'buffer/';
//
// System Configuration
//
const sysConfigStore = useSysConfigStore();
const jwtStore = useJwtStore();
export function forceGeoParquet(inputReqParms: any): any {
    console.log('forceGeoParquet:', inputReqParms, 'inputReqParms.parms.output:', inputReqParms.parms.output);
    if (
        inputReqParms &&
        typeof inputReqParms === 'object' &&
        inputReqParms.parms &&
        typeof inputReqParms.parms === 'object' &&
        inputReqParms.parms.output &&
        typeof inputReqParms.parms.output === 'object'
    ) {
        inputReqParms.parms.output.as_geo = true;
    } else {
        console.error('Invalid inputReqParms structure?:', inputReqParms);
    }
    console.log('forceGeoParquet:', inputReqParms, 'as_geo:', inputReqParms.parms.output.as_geo);
    return inputReqParms;
}

export async function getFetchUrlAndOptions(
    reqid: number,
    isArrowFetch: boolean = false,
    forceAsGeo: boolean = false
): Promise<{ url: string; options: RequestInit }> {
    const api = await db.getFunc(reqid);
    let parm = await db.getReqParams(reqid);
    if(forceAsGeo){
        parm = forceGeoParquet(parm);
    }
    const host = sysConfigStore.getOrganization() && (sysConfigStore.getOrganization() + '.' + sysConfigStore.getDomain()) || sysConfigStore.getDomain();
    const api_path = isArrowFetch ? 'arrow/' + api : 'source/api';
    const url = 'https://' + host + '/' + api_path;
    //console.log('source url:', url);
    // Setup Request Options
    let body = null;
    const options: RequestInit = {
        method: 'POST',
        mode: 'cors', 
    };
    
    if (parm != null) {
        body = JSON.stringify(parm);
        options.headers = {
            'Content-Type': 'application/json', 
            'Content-Length': Buffer.byteLength(body).toString(),
            //'x-sliderule-streaming': '0', // TBD is this neccessary?
        };
        options.body = body;
    }
    // add JWT for Authorization header if present
    let srJWT = useJwtStore().getJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization());
    let accessToken = '';
    if(srJWT){
        accessToken = srJWT.accessToken;
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${srJWT.accessToken}`
        };
    }
    console.log( 'fetch url:', url,'fetch options:', options);
    return { url, options };
}
