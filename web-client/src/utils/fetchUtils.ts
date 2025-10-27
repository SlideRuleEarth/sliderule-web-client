import { db } from '@/db/SlideRuleDb'
import { useSysConfigStore } from '@/stores/sysConfigStore';
import { useJwtStore } from '@/stores/SrJWTStore';
import { Buffer } from 'buffer/';
import { createLogger } from '@/utils/logger';

const logger = createLogger('FetchUtils');
//
// System Configuration
//
const sysConfigStore = useSysConfigStore();
export function forceGeoParquet(inputReqParms: any): any {
    //There are different shapes for legacy atl06 and atl03x-surface
    logger.debug('forceGeoParquet', { inputReqParms });

    if(inputReqParms.as_geo !== undefined){
        inputReqParms.as_geo = true;
    } else {
        if (inputReqParms.parms){
            if(inputReqParms.parms.output){
                inputReqParms.parms.output.as_geo = true;
            } else {
                logger.warn('forceGeoParquet: unrecognized shape for inputReqParms', { inputReqParms });
            }
        } else {
            logger.warn('forceGeoParquet: unrecognized shape for inputReqParms', { inputReqParms });
        }
    }
    logger.debug('forceGeoParquet', { inputReqParms });
    return inputReqParms;
}

export async function getArrowFetchUrlAndOptions(
    reqid: number,
    forceAsGeo: boolean = false
): Promise<{ url: string; options: RequestInit }> {
    let api = await db.getFunc(reqid);
    if((api === 'atl03x-surface') || (api === 'atl03x-phoreal')){
        api = 'atl03x';
    }
    let parm = await db.getReqParams(reqid);
    if(forceAsGeo){
        parm = forceGeoParquet(parm);
    }
    const host = sysConfigStore.getOrganization() && (sysConfigStore.getOrganization() + '.' + sysConfigStore.getDomain()) || sysConfigStore.getDomain();
    const api_path = `arrow/${api}`;
    const url = 'https://' + host + '/' + api_path;
    //console.log('getArrowFetchUrlAndOptions source url:', url);
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
    if(srJWT){
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${srJWT.accessToken}`
        };
    }
    logger.debug('fetch request', { url, options });
    return { url, options };
}
