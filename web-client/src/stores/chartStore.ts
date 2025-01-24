import { defineStore } from 'pinia';
import { getBeamsAndTracksWithGts } from '@/utils/parmUtils';
import { beamsOptions, tracksOptions, spotsOptions, pairOptions, scOrientOptions } from '@/utils/parmUtils';
import {  useAtlChartFilterStore } from './atlChartFilterStore';

export interface SrMenuItem {
    name: string;
    value: string;
}
export interface SrListNumberItem {
    label: string;
    value: number;
}

interface ChartState {
    currentFile: string;
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
    //min_yapc_score: number;
    //max_yapc_score: number;
    elevationDataOptions: string[];
    yDataOptions: string[];
    selectedYData: string;
    selectedColorEncodeData: string;
    xDataForChart: string;
    ndxOfElevationDataOptionsForHeight: number;
    func: string;
    description: string;
    querySql: string;
    whereClause: string;
    size: number;
    recCnt: number;
    xLegend: string;
    numOfPlottedPnts: number;
    selectedAtl03YapcColorMap: SrMenuItem;
    symbolSize: number;
    symbolColorEncoding: string;
    solidSymbolColor: string;
    tracks: Array<SrListNumberItem>;
    selectAllTracks: boolean;
    beams: Array<SrListNumberItem>;
    spots: Array<SrListNumberItem>;
    rgts: Array<SrListNumberItem>;
    cycles: Array<SrListNumberItem>;
    pairs: Array<SrListNumberItem>;
    scOrients: Array<SrListNumberItem>;
    minMaxValues: Record<string, { min: number; max: number }>;
    dataOrderNdx: Record<string, number>;
    showYDataMenu: boolean;
}

const atlChartFilterStore = useAtlChartFilterStore();

export const useChartStore = defineStore('chartStore', {
    state: () => ({
        stateByReqId: {} as Record<string, ChartState>, // Dynamic state keyed by reqIdStr
    }),

    actions: {
        // Initialize a state for a reqIdStr if it doesn't exist
        ensureState(reqIdStr: string): boolean {
            if (typeof reqIdStr !== 'string' || !/^\d+$/.test(reqIdStr)) {
                console.warn('ensureState() encountered an invalid reqIdStr:', reqIdStr, 'Type:', typeof reqIdStr);
                console.trace('Call stack for ensureState with invalid reqIdStr');
                return false; // Exit early to prevent further execution
            }     
            if (!this.stateByReqId[reqIdStr]) {
                //console.log('ensureState() initializing state for reqIdStr:', reqIdStr);
                this.stateByReqId[reqIdStr] = {
                    currentFile: '',
                    min_x: 0,
                    max_x: 0,
                    min_y: 0,
                    max_y: 0,
                    elevationDataOptions: [ 'not_set' ],
                    yDataOptions: [],
                    selectedYData: '',
                    selectedColorEncodeData: 'unset',
                    xDataForChart: 'x_atc',
                    ndxOfElevationDataOptionsForHeight: 0,
                    func: '',
                    description: 'description here',
                    querySql: '',
                    whereClause: '',
                    size: 0,
                    recCnt: 0,
                    xLegend: 'Meters',
                    numOfPlottedPnts: 0,
                    selectedAtl03YapcColorMap: { name: 'viridis', value: 'viridis' },
                    symbolSize: 3,
                    symbolColorEncoding: 'unset',
                    solidSymbolColor: 'red',
                    tracks: [],
                    selectAllTracks: true,
                    beams:[{ label: 'unknown', value: -1}],
                    spots: [],
                    rgts: [], 
                    cycles: [],
                    pairs: [],
                    scOrients: [],
                    minMaxValues: {} as Record<string, { min: number; max: number }>,
                    dataOrderNdx: {} as Record<string, number>,
                    showYDataMenu: false,
                };
            }
            return true;
        },
        setMinX(reqIdStr: string, min_x: number) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].min_x = min_x;
        },
        getMinX(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].min_x;
        },
        setMaxX(reqIdStr: string, max_x: number) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].max_x = max_x;
        },
        getMaxX(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].max_x;
        },
        getMinValue(reqIdStr: string, key: string): number {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].minMaxValues[key].min;
        },
        getMaxValue(reqIdStr: string, key: string): number {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].minMaxValues[key].max;
        },
        setDescription(reqIdStr: string, description: string) { 
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].description = description;
        },
        // Example action to set query SQL for a specific reqIdStr
        setQuerySql(reqIdStr: string, sql: string) {
        this.ensureState(reqIdStr);
        this.stateByReqId[reqIdStr].querySql = sql;
        },
        getQuerySql(reqIdStr?: string): string {
            if (reqIdStr) {
                this.ensureState(reqIdStr);
                return this.stateByReqId[reqIdStr]?.querySql || '';
            } else {
                // Concatenate all `querySql` values from the state objects
                return Object.values(this.stateByReqId)
                    .map(state => state.querySql || '')
                    .filter(sql => sql.trim() !== '') // Remove empty or whitespace-only strings
                    .join(' ');
            }
        },
        setWhereClause(reqIdStr: string, whereClause: string) {
        this.ensureState(reqIdStr);
        this.stateByReqId[reqIdStr].whereClause = whereClause;
        },
        getWhereClause(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].whereClause;
        },
        setSymbolSize(reqIdStr: string, symbolSize: number) {
            //console.log('setSymbolSize reqIdStr:',reqIdStr, ' symbolSize:',symbolSize);
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].symbolSize = symbolSize;
        },
        getSymbolSize(reqIdStr: string): number {
            this.ensureState(reqIdStr);
            //console.log('getSymbolSize reqIdStr:',reqIdStr, ' symbolSize:',this.stateByReqId[reqIdStr].symbolSize);
            return this.stateByReqId[reqIdStr].symbolSize;
        },
        setSymbolColorEncoding(reqIdStr: string, symbolColorEncoding: string) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].symbolColorEncoding = symbolColorEncoding;
        },
        getSymbolColorEncoding(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].symbolColorEncoding;
        },
        setSolidSymbolColor(reqIdStr: string, symbolColor: string): void {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].solidSymbolColor = symbolColor;
        },
        getSolidSymbolColor(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].solidSymbolColor;
        },
        getElevationDataOptionForHeight(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].elevationDataOptions[this.stateByReqId[reqIdStr].ndxOfElevationDataOptionsForHeight];
        },
        getNdxOfElevationDataOptionsForHeight(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].ndxOfElevationDataOptionsForHeight;
        },
        setNdxOfElevationDataOptionsForHeight(reqIdStr: string,ndx: number) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].ndxOfElevationDataOptionsForHeight = ndx;
        },
        getElevationDataOptions(reqIdStr: string) : string[] {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].elevationDataOptions;
        },
        setElevationDataOptions(reqIdStr: string, elevationDataOptions: string[]) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].elevationDataOptions = elevationDataOptions;
        },
        getYDataOptions(reqIdStr: string): string[] {
            this.ensureState(reqIdStr);
            const yData =  this.stateByReqId[reqIdStr].yDataOptions;
            //console.log('getYDataOptions reqIdStr:',reqIdStr, ' yData:',yData);
            return yData;
        },
        setYDataOptions(reqIdStr: string,yDataOptions: string[]): void {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].yDataOptions = yDataOptions;
            //console.log('setYDataOptions reqIdStr:',reqIdStr, ' yData:',yDataOptions, ' state yData:',this.stateByReqId[reqIdStr].yDataOptions);
        },
        getColorEncodeOptionsForFunc(reqIdStr: string,func: string): string[] {
            if(func.includes('atl03sp')) {
                return this.getYDataOptions(reqIdStr);
            } else if(func.includes('atl03vp')) {
                const ret = ['solid'];
                return ret.concat(this.getYDataOptions(reqIdStr));
            } else if(func.includes('atl06')) {
                const ret = ['solid'];
                return ret.concat(this.getYDataOptions(reqIdStr));
            } else if(func.includes('atl08')) {
                const ret = ['solid'];
                return ret.concat(this.getYDataOptions(reqIdStr));
            } else {
                console.error('getColorEncodeOptionsForFunc() unknown function:', func);
                return [];
            }  
        }, 
        getSelectedYData(reqIdStr: string): string {
            if(this.ensureState(reqIdStr)){
                return this.stateByReqId[reqIdStr].selectedYData;
            } else {
                return '';
            }
        },
        setSelectedYData(reqIdStr: string, newVal: string) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].selectedYData = newVal;
        },
        getSelectedColorEncodeData(reqIdStr: string): string {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].selectedColorEncodeData;
        },
        setSelectedColorEncodeData(reqIdStr: string, newVal: string) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].selectedColorEncodeData = newVal;
        },    
        getXDataForChart(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].xDataForChart;
        },
        setXDataForChart(reqIdStr: string, xDataForChart: string) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].xDataForChart = xDataForChart;
        },
        setXDataForChartUsingFunc(reqIdStr: string,func: string) {
            this.ensureState(reqIdStr);
            if (func.includes('atl03sp')) {
                this.setXDataForChart(reqIdStr,'x_atc');
            } else if (func.includes('atl03vp')) {
                this.setXDataForChart(reqIdStr,'segment_dist_x');
            } else if (func.includes('atl06')) {
                this.setXDataForChart(reqIdStr,'x_atc');
            } else if (func.includes('atl08')) {
                this.setXDataForChart(reqIdStr,'x_atc');
            } else {
                console.error('setXDataForChartFromFunc() unknown function:', func);
            }
        },
        getFile(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].currentFile;
        },
        setFile(reqIdStr: string,fileName: string) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].currentFile = fileName;
        },
        getFunc(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].func;
        },
        setFunc(reqIdStr: string,func: string) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].func = func;
        },
        setXLegend(reqIdStr: string,xLegend: string) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].xLegend = xLegend;
        },
        getXLegend(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].xLegend;
        },
        getSize(reqIdStr?: string): number {
            if (reqIdStr) {
                // Return size for the specific reqIdStr if it exists
                this.ensureState(reqIdStr);
                return this.stateByReqId[reqIdStr]?.size || 0;
            }
        
            // Sum all sizes for all keys if reqIdStr is not provided
            return Object.values(this.stateByReqId).reduce((total, state) => {
                return total + (state.size || 0);
            }, 0);
        },
        setSize(reqIdStr: string,size: number) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].size = size;
        },
        getRecCnt(reqIdStr?: string): number {
            if (reqIdStr) {
                // Return recCnt for the specific reqIdStr if it exists
                this.ensureState(reqIdStr);
                return this.stateByReqId[reqIdStr]?.recCnt || 0;
            }
        
            // Sum all sizes for all keys if reqIdStr is not provided
            return Object.values(this.stateByReqId).reduce((total, state) => {
                return total + (state.recCnt || 0);
            }, 0);
        },
        setRecCnt(reqIdStr: string,recCnt: number) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].recCnt = recCnt;
        },
        getNumOfPlottedPnts(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr]?.numOfPlottedPnts;
        },
        setNumOfPlottedPnts(reqIdStr: string, numOfPlottedPnts: number,) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].numOfPlottedPnts = numOfPlottedPnts;
        },

        setBeams(reqIdStr: string, beams: SrListNumberItem[]) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].beams = beams;
        },
        getBeams(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].beams;
        },
        getBeamValues(reqIdStr: string) { 
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].beams.map(beam => beam.value);
        },
        setSpots(reqIdStr: string, spots: SrListNumberItem[]) {
            this.ensureState(reqIdStr);
            //console.log('atlChartFilterStore setSpots:', spots);
            this.stateByReqId[reqIdStr].spots = spots;
        },
        getSpots(reqIdStr: string): SrListNumberItem[] {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].spots;
        },
        getSpotValues(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].spots.map(spot => spot.value);
        },
        setSpotWithNumber(reqIdStr: string, spot: number) {
            this.ensureState(reqIdStr);
            //console.log('atlChartFilterStore.setSpotWithNumber():', spot);
            this.setSpots(reqIdStr,[{ label: spot.toString(), value: spot }]);
        },
        setRgts(reqIdStr: string, rgts: SrListNumberItem[]) {
            this.ensureState(reqIdStr);
            //console.log('atlChartFilterStore setRgts:', rgts);
            this.stateByReqId[reqIdStr].rgts = rgts;
        },
        getRgts(reqIdStr: string) {
            this.ensureState(reqIdStr);
            //console.log('atlChartFilterStore getRgts:', this.rgts);
            return this.stateByReqId[reqIdStr].rgts;
        },
        getRgtValues(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].rgts.map(rgt => rgt.value);
        },
        getCycleValues(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].cycles.map(cycle => cycle.value);
        },
        setRgtWithNumber(reqIdStr: string, rgt: number) {
            this.ensureState(reqIdStr);
            //console.log('atlChartFilterStore.setRgtWithNumber():', rgt);
            this.setRgts(reqIdStr,[{ label: rgt.toString(), value: rgt }]);
        },
        setCycleWithNumber(reqIdStr: string, cycle: number) {
            this.ensureState(reqIdStr);
            //console.log('atlChartFilterStore.setCycleWithNumber():', cycle);
            this.setCycles(reqIdStr,[{ label: cycle.toString(), value: cycle }]);
        },
        setCycles(reqIdStr: string, cycles: SrListNumberItem[]) {
            this.ensureState(reqIdStr);
            //console.log('atlChartFilterStore.setCycles():', cycles);
            this.stateByReqId[reqIdStr].cycles = cycles;
        },
        getCycles(reqIdStr: string) {
            this.ensureState(reqIdStr);
            //console.log('atlChartFilterStore.getCycles():', this.cycles);
            return this.stateByReqId[reqIdStr].cycles;
        },
        setTracks(reqIdStr: string, tracks: SrListNumberItem[]) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].tracks = tracks;
        },
        getTracks(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].tracks;
        },
        setTrackWithNumber(reqIdStr: string, track: number) {
            this.ensureState(reqIdStr);
            this.setTracks(reqIdStr,[{ label: track.toString(), value: track }]);
            //console.log('atlChartFilterStore.setTrackWithNumber(', track,') tracks:', this.tracks);
        },
        getTrackValues(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].tracks.map(track => track.value);
        },
        setSelectAllTracks(reqIdStr: string, selectAllTracks: boolean) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].selectAllTracks = selectAllTracks;
        },
        getSelectAllTracks(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].selectAllTracks;
        },
        appendTrackWithNumber(reqIdStr: string, track: number) {
            this.ensureState(reqIdStr);
            // Check if the track already exists in the list
            const trackExists = this.stateByReqId[reqIdStr].tracks.some(t => t.value === track);
            // If it doesn't exist, append it
            if (!trackExists) {
                this.stateByReqId[reqIdStr].tracks.push({ label: track.toString(), value: track });
            }
        },    
        setBeamsAndTracksWithGts(reqIdStr: string, gts: SrListNumberItem[]) {
            this.ensureState(reqIdStr);
            //console.log('atlChartFilterStore.setBeamsAndTracksWithGts(',gt,')');
            const parms = getBeamsAndTracksWithGts(gts);
            this.setBeams(reqIdStr,parms.beams);
            this.setTracks(reqIdStr,parms.tracks);
        },
        setTracksForBeams(reqIdStr: string, input_beams: SrListNumberItem[]) {    
            this.ensureState(reqIdStr);
            const tracks = input_beams
                .map(beam => tracksOptions.find(track => Number(beam.label.charAt(2)) === track.value))
                .filter((track): track is SrListNumberItem => track !== undefined);
            this.setTracks(reqIdStr,tracks);
        },
        setBeamsForTracks(reqIdStr: string, input_tracks: SrListNumberItem[]) {
            this.ensureState(reqIdStr);
            const beams = input_tracks
                .map(track => beamsOptions.find(option => Number(track) === Number(option.label.charAt(2))))
                .filter((beam): beam is SrListNumberItem => beam !== undefined);
            this.setBeams(reqIdStr,beams);
            //console.log('atlChartFilterStore.setBeamsForTracks(',input_tracks,') beams:', beams);
        },
        setBeamWithNumber(reqIdStr: string, beam: number) {
            this.ensureState(reqIdStr);
            this.setBeams(reqIdStr,[{ label: beamsOptions.find(option => option.value === beam)?.label || '', value: beam }]);
        },
        setPairs(reqIdStr: string, pairs: SrListNumberItem[]) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].pairs = pairs;
        },
        getPairs(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].pairs;
        },
        setPairWithNumber(reqIdStr: string, pair: number) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].pairs = [{ label: pair.toString(), value: pair }];
        },
        appendPairWithNumber(reqIdStr: string,pair: number) {
            this.ensureState(reqIdStr);
            const pairExists = this.stateByReqId[reqIdStr].pairs.some(p => p.value === pair);
            if(!pairExists){
                this.stateByReqId[reqIdStr].pairs.push({ label: pair.toString(), value: pair });
            }
        },
        getPairValues(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].pairs.map(pair => pair.value);
        },
        setScOrients(reqIdStr: string, scOrients: SrListNumberItem[]) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].scOrients = scOrients;
        },
        getScOrients(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].scOrients;
        },
        setScOrientWithNumber(reqIdStr: string, scOrient: number) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].scOrients = [{ label: scOrient.toString(), value: scOrient }];
        },
        getScOrientValues(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].scOrients.map(scOrient => scOrient.value);
        },
        appendScOrientWithNumber(reqIdStr: string, scOrient: number) {
            this.ensureState(reqIdStr);
            const scoExists = this.stateByReqId[reqIdStr].scOrients.some(sco => sco.value === scOrient);
            if(!scoExists && (scOrient >= 0)){
                this.stateByReqId[reqIdStr].scOrients.push({ label: scOrient.toString(), value: scOrient });
            }
        },
        setMinMaxValues(reqIdStr: string, minMaxValues: Record<string, { min: number; max: number }>):void {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].minMaxValues = minMaxValues;
        },
        getMinMaxValues(reqIdStr: string) : Record<string, { min: number; max: number }>{
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].minMaxValues;
        },
        getDataOrderNdx(reqIdStr: string): Record<string, number> {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].dataOrderNdx;
        },
        setDataOrderNdx(reqIdStr: string, dataOrderNdx: Record<string, number>): void {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].dataOrderNdx = dataOrderNdx;
        },
        setShowYDataMenu(reqIdStr: string, showYDataMenu: boolean): void {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].showYDataMenu = showYDataMenu;
            //console.log('setShowYDataMenu', showYDataMenu);
        },
        getShowYDataMenu(reqIdStr: string): boolean {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].showYDataMenu;
        },
    },
});
