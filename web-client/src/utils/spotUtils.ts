
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
    return lookup_table[index];
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
    let sc_orient = -1;
    let track = -1;
    let pair = -1;
    switch (spot) {
        case SPOT_1:
            sc_orient = 0;
            track = 3;
            pair = 1;
            break;
        case SPOT_2:
            sc_orient = 0;
            track = 3;
            pair = 2;
            break;
        case SPOT_3:
            sc_orient = 0;
            track = 2;
            pair = 1;
            break;
        case SPOT_4:
            sc_orient = 0;
            track = 2;
            pair = 2;
            break;
        case SPOT_5:
            sc_orient = 0;
            track = 1;
            pair = 1;
            break;
        case SPOT_6:
            sc_orient = 0;
            track = 1;
            pair = 2;
            break;
        default:
            console.log('getSpotGtFromSpotNumber: INVALID spot:', spot);
            break;
    }
    return {sc_orient, track, pair};
}

export function getDetailsFromGroundTrack(gt:number) {
    let sc_orient = -1;
    let spot = -1;
    let pair = -1;
    switch (gt) {
        case GT1L:
            sc_orient = 0;
            spot = 6;
            pair = 1;
            break;
        case GT1R:
            sc_orient = 0;
            spot = 5;
            pair = 2;
            break;
        case GT2L:
            sc_orient = 0;
            spot = 4;
            pair = 1;
            break;
        case GT2R:
            sc_orient = 0;
            spot = 4;
            pair = 2;
            break;
        case GT3L:
            sc_orient = 0;
            spot = 3;
            pair = 1;
            break;
        case GT3R:
            sc_orient = 0;
            spot = 3;
            pair = 2;
            break;
        default:
            console.log('getSpotGtFromGroundTrack: INVALID gt:', gt);
            break;
    }
    return {sc_orient, spot, pair};
}

export function getSqlForSpot(spot:number){
    const {sc_orient, track, pair} = getDetailsFromSpotNumber(spot);
    return 'sc_orient = ' + sc_orient + ' AND track = ' + track + ' AND pair = ' + pair;
}

export function getSqlForGroundTrack(gt:number){
    const {sc_orient, spot, pair} = getDetailsFromGroundTrack(gt);
    return 'sc_orient = ' + sc_orient + ' AND spot = ' + spot + ' AND pair = ' + pair;
}

export function getSqlForSpots(spots:number[]){
    const sqls = spots.map(spot => getSqlForSpot(spot));
    return sqls.join(' OR ');
}

export function getSqlForGroundTracks(gts:number[]){
    const sqls = gts.map(gt => getSqlForGroundTrack(gt));
    return sqls.join(' OR ');
}

export function getSqlForAtl03WithSpots(filename:string,rgts:number[],cycles:number[], spots:number[]){
    const queryStr = `
            SELECT * FROM '${filename}' 
            WHERE (rgt IN (${rgts.join(', ')}) 
            AND cycle IN (${cycles.join(', ')}))
             `
    if (spots.length > 0) {
        return queryStr + ' AND (' + getSqlForSpots(spots) + ')';
    }
    return queryStr;
}