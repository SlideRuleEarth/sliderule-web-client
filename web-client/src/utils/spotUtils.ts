
const SPOT_1 = 1;
const SPOT_2 = 2;
const SPOT_3 = 3;
const SPOT_4 = 4;
const SPOT_5 = 5;
const SPOT_6 = 6;
const INVALID_SPOT = -1;

const GT1L = 10;
const GT1R = 20;
const GT2L = 30;
const GT2R = 40;
const GT3L = 50;
const GT3R = 60;
const INVALID_GT = -1;

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
    console.log('getSpotNumber: sc_orient:', sc_orient, 'track:', track, 'pair:', pair, 'spot:', spot);
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
            console.log('getSpotGtFromSpotNumber: INVALID spot:', spot);
            break;
    }
    return details;
}

export function getSqlForSpot(spot:number){
    const d= getDetailsFromSpotNumber(spot);
    const sqlStr = `((sc_orient = ${d[0].sc_orient}) AND (track = ${d[0].track}) AND (pair = ${d[0].pair})) OR ((sc_orient = ${d[1].sc_orient}) AND (track = ${d[1].track}) AND (pair = ${d[1].pair}))`;
    console.log('getSqlForSpot: spot:', spot, 'sqlStr:', sqlStr);
    return sqlStr;
}

// export function getSqlForGroundTrack(gt:number){
//     const {sc_orient, spot, pair} = getDetailsFromGroundTrack(gt);
//     return '(sc_orient = ' + sc_orient + ' AND spot = ' + spot + ' AND pair = ' + pair + ')';
// }

export function getSqlForSpots(spots:number[]){
    const sqls = spots.map(spot => getSqlForSpot(spot));
    return sqls.join(' OR ');
}

// export function getSqlForGroundTracks(gts:number[]){
//     const sqls = gts.map(gt => getSqlForGroundTrack(gt));
//     return '(' + sqls.join(' OR ') + ')';
// }

export function getWhereClause(func:string, spots:number[],rgts:number[],cycles:number[]){
    console.log('getWhereClause: func:', func);
    console.log('getWhereClause: spots:', spots);
    console.log('getWhereClause: rgts:', rgts);
    console.log('getWhereClause: cycles:', cycles);
    let whereStr = '';
    if (func === 'atl03'){
        if ((rgts.length > 0) || (cycles.length > 0)) {
            whereStr = 'WHERE ';
            if (rgts.length > 0) {
                whereStr = whereStr + `rgt IN (${rgts.join(', ')})`;
            }
            if (cycles.length > 0) {
                if (rgts.length > 0) {
                    whereStr = whereStr + ' AND ';
                }
                whereStr = whereStr + `cycle IN (${cycles.join(', ')})`;
            }
            if (spots.length > 0) {
                whereStr = whereStr + ' AND (' + getSqlForSpots(spots) + ')';
            }
        }
    } else if ((func === 'atl06') || (func === 'atl08')) {
        if ((rgts.length > 0) || (cycles.length > 0)) {
            whereStr = 'WHERE ';
            if (rgts.length > 0) {
                whereStr = whereStr + `rgt IN (${rgts.join(', ')})`;
            }
            if (cycles.length > 0) {
                if (rgts.length > 0) {
                    whereStr = whereStr + ' AND ';
                }
                whereStr = whereStr + `cycle IN (${cycles.join(', ')})`;
            }
            if (spots.length > 0) {
                whereStr = whereStr + ` AND spot IN (${spots.join(', ')})`;
            }
        }
    } else {
        console.error('getWhereClause: INVALID func:', func);
    }
    console.log('getWhereClause: whereStr:', whereStr);
    return whereStr;
}
