import { defineStore } from 'pinia';
export interface SrMenuItem {
    name: string;
    value: string;
}

interface ChartState {
    currentFile: string;
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
    raw_min_x: number;
    elevationDataOptions: string[];
    yDataOptions: string[];
    selectedYData: string;
    selectedColorEncodeData: string;
    savedColorEncodeData: string;
    xDataForChart: string;
    ndxOfElevationDataOptionsForHeight: number;
    description: string;
    querySql: string;
    whereClause: string;
    size: number;
    recCnt: number;
    xLegend: string;
    numOfPlottedPnts: number;
    selectedAtl03YapcColorMap: SrMenuItem;
    //symbolSize: number;
    symbolColorEncoding: string;
    solidSymbolColor: string;
    selectAllTracks: boolean;
    minMaxValues: Record<string, { min: number; max: number }>;
    dataOrderNdx: Record<string, number>;
    showYDataMenu: boolean;
}


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
                    raw_min_x: 0,
                    elevationDataOptions: [ 'not_set' ],
                    yDataOptions: [],
                    selectedYData: '',
                    selectedColorEncodeData: 'unset',
                    xDataForChart: 'x_atc',
                    ndxOfElevationDataOptionsForHeight: 0,
                    description: 'description here',
                    querySql: '',
                    whereClause: '',
                    size: 0,
                    recCnt: 0,
                    xLegend: 'Meters',
                    numOfPlottedPnts: 0,
                    selectedAtl03YapcColorMap: { name: 'viridis', value: 'viridis' },
                    //symbolSize: 3,
                    symbolColorEncoding: 'unset',
                    savedColorEncodeData: 'unset',
                    solidSymbolColor: 'red',
                    selectAllTracks: true,
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
        setRawMinX(reqIdStr: string, min_x: number) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].raw_min_x = min_x;
        },
        getRawMinX(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].raw_min_x;
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
            if(this.stateByReqId[reqIdStr]?.minMaxValues && this.stateByReqId[reqIdStr].minMaxValues[key]){
                return this.stateByReqId[reqIdStr].minMaxValues[key].min;
            } else {
                //console.log('getMinValue() key:', key, ' not found in minMaxValues for:', reqIdStr);
                //console.trace('Call stack for getMinValue()');
                return 0;
            }
        },
        getMaxValue(reqIdStr: string, key: string): number {
            this.ensureState(reqIdStr);
            if(this.stateByReqId[reqIdStr]?.minMaxValues && this.stateByReqId[reqIdStr].minMaxValues[key]){
                return this.stateByReqId[reqIdStr].minMaxValues[key].max;
            } else {
                //console.log('getMaxValue() key:', key, ' not found in minMaxValues for:', reqIdStr);
                return 0;
            }
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
        getQuerySql(reqIdStr: string): string {
            if(this.ensureState(reqIdStr)){
                return this.stateByReqId[reqIdStr].querySql;
            } else {
                return '';
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
        // setSymbolSize(reqIdStr: string, symbolSize: number) {
        //     //console.log('setSymbolSize reqIdStr:',reqIdStr, ' symbolSize:',symbolSize);
        //     this.ensureState(reqIdStr);
        //     this.stateByReqId[reqIdStr].symbolSize = symbolSize;
        // },
        // getSymbolSize(reqIdStr: string): number {
        //     this.ensureState(reqIdStr);
        //     //console.log('getSymbolSize reqIdStr:',reqIdStr, ' symbolSize:',this.stateByReqId[reqIdStr].symbolSize);
        //     return this.stateByReqId[reqIdStr].symbolSize;
        // },
        setSymbolColorEncoding(reqIdStr: string, symbolColorEncoding: string) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].symbolColorEncoding = symbolColorEncoding;
        },
        getSymbolColorEncoding(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].symbolColorEncoding;
        },
        setSavedColorEncodeData(reqIdStr: string, savedColorEncodeData: string) {
            this.ensureState(reqIdStr);
            this.stateByReqId[reqIdStr].savedColorEncodeData = savedColorEncodeData;
        },
        getSavedColorEncodeData(reqIdStr: string) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr].savedColorEncodeData;
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
            } else if(func.includes('atl03x')) {
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
            } else if(func.includes('atl24')) {
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
            const selectedColorEncodeData = this.stateByReqId[reqIdStr].selectedColorEncodeData;
            //console.log('getSelectedColorEncodeData reqIdStr:',reqIdStr, ' selectedColorEncodeData:',selectedColorEncodeData);
            return selectedColorEncodeData;
        },
        setSelectedColorEncodeData(reqIdStr: string, newVal: string) {
            this.ensureState(reqIdStr);
            //console.log('setSelectedColorEncodeData reqIdStr:',reqIdStr, ' newVal:',newVal);
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
            } else if (func.includes('atl03x')) {
                this.setXDataForChart(reqIdStr,'x_atc');
            } else if (func.includes('atl03vp')) {
                this.setXDataForChart(reqIdStr,'segment_dist_x');
            } else if (func.includes('atl06')) {
                this.setXDataForChart(reqIdStr,'x_atc');
            } else if (func.includes('atl08')) {
                this.setXDataForChart(reqIdStr,'x_atc');
            } else if (func.includes('atl24')) {
                this.setXDataForChart(reqIdStr,'x_atc');
            } else {
                console.error('setXDataForChartUsingFunc() unknown function:', func);
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
