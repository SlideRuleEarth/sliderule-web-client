
import { SC_FORWARD,SC_BACKWARD } from '@/sliderule/icesat2';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { useRecTreeStore } from '@/stores/recTreeStore';
const SPOT_1 = 1;
const SPOT_2 = 2;
const SPOT_3 = 3;
const SPOT_4 = 4;
const SPOT_5 = 5;
const SPOT_6 = 6;
const INVALID_SPOT = -1;

export const GT1L = 10;
export const GT1R = 20;
export const GT2L = 30;
export const GT2R = 40;
export const GT3L = 50;
export const GT3R = 60;
export const INVALID_GT = -1;

const SC_UNKNOWN = -1;

export function getSpotNumber(sc_orient:number, track:number, pair:number) {
    //const num_combinations = 18; // 3(number of s/c orientations) * 3(number of tracks) * 2(number of pairs)
    const lookup_table = [
        SPOT_1, // SC_BACKWARD, RPT_1, RPT_L
        SPOT_2, // SC_BACKWARD, RPT_1, RPT_R
        SPOT_3, // SC_BACKWARD, RPT_2, RPT_L
        SPOT_4, // SC_BACKWARD, RPT_2, RPT_R
        SPOT_5, // SC_BACKWARD, RPT_3, RPT_L
        SPOT_6, // SC_BACKWARD, RPT_3, RPT_R
        SPOT_6, // SC_FORWARD, RPT_1, RPT_L
        SPOT_5, // SC_FORWARD, RPT_1, RPT_R
        SPOT_4, // SC_FORWARD, RPT_2, RPT_L
        SPOT_3, // SC_FORWARD, RPT_2, RPT_R
        SPOT_2, // SC_FORWARD, RPT_3, RPT_L
        SPOT_1, // SC_FORWARD, RPT_3, RPT_R
        INVALID_SPOT, // SC_TRANSITION, RPT_1, RPT_L
        INVALID_SPOT, // SC_TRANSITION, RPT_1, RPT_R
        INVALID_SPOT, // SC_TRANSITION, RPT_2, RPT_L
        INVALID_SPOT, // SC_TRANSITION, RPT_2, RPT_R
        INVALID_SPOT, // SC_TRANSITION, RPT_3, RPT_L
        INVALID_SPOT, // SC_TRANSITION, RPT_3, RPT_R
    ];
    const index = (sc_orient * 6) + ((track - 1) * 2) + pair;
    const spot = lookup_table[index];
    //console.log('getSpotNumber: sc_orient:', sc_orient, 'track:', track, 'pair:', pair, 'spot:', spot);
    return spot;
}

export function getGroundTrack(sc_orient:number, track:number, pair:number) {
    //const num_combinations = 18; // 3(number of s/c orientations) * 3(number of tracks) * 2(number of pairs)
    const lookup_table = [
        GT1L, // SC_BACKWARD, RPT_1, RPT_L
        GT1R, // SC_BACKWARD, RPT_1, RPT_R
        GT2L, // SC_BACKWARD, RPT_2, RPT_L
        GT2R, // SC_BACKWARD, RPT_2, RPT_R
        GT3L, // SC_BACKWARD, RPT_3, RPT_L
        GT3R, // SC_BACKWARD, RPT_3, RPT_R
        GT1L, // SC_FORWARD, RPT_1, RPT_L
        GT1R, // SC_FORWARD, RPT_1, RPT_R
        GT2L, // SC_FORWARD, RPT_2, RPT_L
        GT2R, // SC_FORWARD, RPT_2, RPT_R
        GT3L, // SC_FORWARD, RPT_3, RPT_L
        GT3R, // SC_FORWARD, RPT_3, RPT_R
        INVALID_GT, // SC_TRANSITION, RPT_1, RPT_L
        INVALID_GT, // SC_TRANSITION, RPT_1, RPT_R
        INVALID_GT, // SC_TRANSITION, RPT_2, RPT_L
        INVALID_GT, // SC_TRANSITION, RPT_2, RPT_R
        INVALID_GT, // SC_TRANSITION, RPT_3, RPT_L
        INVALID_GT, // SC_TRANSITION, RPT_3, RPT_R
    ];
    const index = (sc_orient * 6) + ((track - 1) * 2) + pair;
    return lookup_table[index];
}

export function getDetailsFromSpotNumber(spot:number) {
    const details = [{sc_orient: -1, track: -1, pair: -1},{sc_orient: -1, track: -1, pair: -1}];
    switch (spot) {
        case SPOT_1:
            details[0].sc_orient = 0;
            details[0].track = 1;
            details[0].pair = 0;
            details[1].sc_orient = 1;
            details[1].track = 3;
            details[1].pair = 1;
            break;
        case SPOT_2:
            details[0].sc_orient = 0;
            details[0].track = 1;
            details[0].pair = 1;
            details[1].sc_orient = 1;
            details[1].track = 3;
            details[1].pair = 0;
            break;
        case SPOT_3:
            details[0].sc_orient = 0;
            details[0].track = 2;
            details[0].pair = 0;
            details[1].sc_orient = 1;
            details[1].track = 2;
            details[1].pair = 1;
            break;
        case SPOT_4:
            details[0].sc_orient = 0;
            details[0].track = 2;
            details[0].pair = 1;
            details[1].sc_orient = 1;
            details[1].track = 2;
            details[1].pair = 0;
            break;
        case SPOT_5:
            details[0].sc_orient = 0;
            details[0].track = 3;
            details[0].pair = 0;
            details[1].sc_orient = 1;
            details[1].track = 1;
            details[1].pair = 1;
            break;
        case SPOT_6:
            details[0].sc_orient = 0;
            details[0].track = 3;
            details[0].pair = 1;
            details[1].sc_orient = 1;
            details[1].track = 1;
            details[1].pair = 0;
            break;
        default:
            console.warn('getDetailsFromSpotNumber: INVALID spot:', spot);
            break;
    }
    return details;
}

export function getScOrientFromSpotAndGt(spot:number, gt:number){
    const d = getDetailsFromSpotNumber(spot);
    let sc_orient = SC_UNKNOWN;
    if (gt == GT1L && spot == SPOT_1){
        sc_orient = SC_BACKWARD;
    } else if (gt == GT1L && spot == SPOT_6){
        sc_orient = SC_FORWARD;
    } else if (gt == GT2L && spot == SPOT_3){
        sc_orient = SC_BACKWARD;
    } else if (gt == GT2L && spot == SPOT_4){
        sc_orient = SC_FORWARD;
    } else if (gt == GT3L && spot == SPOT_5){
        sc_orient = SC_BACKWARD;
    } else if (gt == GT3L && spot == SPOT_2){
        sc_orient = SC_FORWARD;
    } else if (gt == GT1R && spot == SPOT_2){
        sc_orient = SC_BACKWARD;
    } else if (gt == GT1R && spot == SPOT_5){
        sc_orient = SC_FORWARD;
    } else if (gt == GT2R && spot == SPOT_4){
        sc_orient = SC_BACKWARD;
    } else if (gt == GT2R && spot == SPOT_3){
        sc_orient = SC_FORWARD;
    } else if (gt == GT3R && spot == SPOT_6){
        sc_orient = SC_BACKWARD;
    } else if (gt == GT3R && spot == SPOT_1){
        sc_orient = SC_FORWARD;
    } else {
        console.warn('getScOrientFromSpotAndGt: INVALID spot:', spot, 'gt:', gt);
    }

    return sc_orient;
}

export function getSqlForSpot(spot:number){
    const d= getDetailsFromSpotNumber(spot);
    const sqlStr = `((sc_orient = ${d[0].sc_orient}) AND (track = ${d[0].track}) AND (pair = ${d[0].pair})) OR ((sc_orient = ${d[1].sc_orient}) AND (track = ${d[1].track}) AND (pair = ${d[1].pair}))`;
    //console.log('getSqlForSpot: spot:', spot, 'sqlStr:', sqlStr);
    return sqlStr;
}

export function getSqlForSpots(spots:number[]){
    const sqls = spots.map(spot => getSqlForSpot(spot));
    return sqls.join(' OR ');
}

export function createWhereClause(reqId:number){
    const globalChartStore = useGlobalChartStore();
    const func = useRecTreeStore().findApiForReqId(reqId);
    const spots = globalChartStore.getSpots();
    const rgt = globalChartStore.getRgt();
    const cycles = globalChartStore.getCycles();
    const pairs = globalChartStore.getPairs();
    const sc_orients = globalChartStore.getScOrients();
    const tracks = globalChartStore.getTracks();
    
    //console.log('createWhereClause: cycles:', cycles);
    let whereStr = '';
    if (func === 'atl03sp'){
        if ((rgt >= 0) || (cycles.length > 0)) {
            whereStr = 'WHERE ';
            if( rgt >= 0){
                whereStr = whereStr + `rgt = ${rgt}`;
            } else {
                console.error('createWhereClause: rgt is empty for func:', func);
            }
            if (cycles.length > 0) {
                if( rgt >= 0){
                    whereStr = whereStr + ' AND ';
                }
                whereStr = whereStr + `cycle IN (${cycles.join(', ')})`;
            } else {
                console.error('createWhereClause: cycles is empty for func:', func);
            }
            if (spots.length > 0) {
                if (spots.length > 0) {
                    whereStr = whereStr + ' AND (' + getSqlForSpots(spots) + ')';
                }
            }
        }
    } else if ((func === 'atl03vp') || (func.includes('atl06')) || (func.includes('atl08'))) {
        if ((rgt >= 0) || (cycles.length > 0)) {
            whereStr = 'WHERE ';
            if( rgt >= 0){
                whereStr = whereStr + `rgt = ${rgt}`;
            }
            if (cycles.length > 0) {
                if( rgt >= 0){
                    whereStr = whereStr + ' AND ';
                }
                whereStr = whereStr + `cycle IN (${cycles.join(', ')})`;
            }
            if (spots.length > 0) {
                whereStr = whereStr + ` AND spot IN (${spots.join(', ')})`;
            }
        }
    } else {
        console.error('createWhereClause: INVALID func:', func);
    }
    console.log('createWhereClause req_id:', reqId, 'func:', func, 'spots:', spots, 'rgt:', rgt, 'cycles:', cycles, 'pairs:', pairs, 'sc_orients:', sc_orients, 'tracks:', tracks, 'whereStr:', whereStr);
    return whereStr;
}

export function getGtLabelsForSpotsAndScOrients(spots:number[], sc_orients:number[]){
    const labels = [];
    if(spots.includes(SPOT_1) && sc_orients.includes(SC_BACKWARD)){
        labels.push('GT1L');
    } 
    if(spots.includes(SPOT_1) && sc_orients.includes(SC_FORWARD)){
        labels.push('GT3R');
    }
    if(spots.includes(SPOT_2) && sc_orients.includes(SC_BACKWARD)){
        labels.push('GT1R');
    }
    if(spots.includes(SPOT_2) && sc_orients.includes(SC_FORWARD)){
        labels.push('GT3L');
    }
    if(spots.includes(SPOT_3) && sc_orients.includes(SC_BACKWARD)){
        labels.push('GT2L');
    }
    if(spots.includes(SPOT_3) && sc_orients.includes(SC_FORWARD)){
        labels.push('GT2R');
    }
    if(spots.includes(SPOT_4) && sc_orients.includes(SC_BACKWARD)){
        labels.push('GT2R');
    }
    if(spots.includes(SPOT_4) && sc_orients.includes(SC_FORWARD)){
        labels.push('GT2L');
    }
    if(spots.includes(SPOT_5) && sc_orients.includes(SC_BACKWARD)){
        labels.push('GT3L');
    }
    if(spots.includes(SPOT_5) && sc_orients.includes(SC_FORWARD)){
        labels.push('GT1R');
    }
    if(spots.includes(SPOT_6) && sc_orients.includes(SC_BACKWARD)){
        labels.push('GT3R');
    }
    if(spots.includes(SPOT_6) && sc_orients.includes(SC_FORWARD)){
        labels.push('GT1L');
    }

    return labels;
}

export function getGtsForSpotsAndScOrients(spots:number[], sc_orients:number[]){
    const gts = [];
    if(spots.includes(SPOT_1) && sc_orients.includes(SC_BACKWARD)){
        gts.push(GT1L);
    } 
    if(spots.includes(SPOT_1) && sc_orients.includes(SC_FORWARD)){
        gts.push(GT3R);
    }
    if(spots.includes(SPOT_2) && sc_orients.includes(SC_BACKWARD)){
        gts.push(GT1R);
    }
    if(spots.includes(SPOT_2) && sc_orients.includes(SC_FORWARD)){
        gts.push(GT3L);
    }
    if(spots.includes(SPOT_3) && sc_orients.includes(SC_BACKWARD)){
        gts.push(GT2L);
    }
    if(spots.includes(SPOT_3) && sc_orients.includes(SC_FORWARD)){
        gts.push(GT2R);
    }
    if(spots.includes(SPOT_4) && sc_orients.includes(SC_BACKWARD)){
        gts.push(GT2R);
    }
    if(spots.includes(SPOT_4) && sc_orients.includes(SC_FORWARD)){
        gts.push(GT2L);
    }
    if(spots.includes(SPOT_5) && sc_orients.includes(SC_BACKWARD)){
        gts.push(GT3L);
    }
    if(spots.includes(SPOT_5) && sc_orients.includes(SC_FORWARD)){
        gts.push(GT1R);
    }
    if(spots.includes(SPOT_6) && sc_orients.includes(SC_BACKWARD)){
        gts.push(GT3R);
    }
    if(spots.includes(SPOT_6) && sc_orients.includes(SC_FORWARD)){
        gts.push(GT1L);
    }
    console.log('getGtsForSpotsAndScOrients: spots:', spots, 'sc_orients:', sc_orients, 'gts:', gts);
    return gts;
}
