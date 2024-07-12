
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
