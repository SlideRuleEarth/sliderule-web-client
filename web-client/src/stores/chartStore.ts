import { defineStore } from 'pinia';
import { getHeightFieldname } from '@/utils/SrParquetUtils';

interface ChartState {
  currentFile: string;
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  elevationDataOptions: string[];
  yDataForChart: string[];
  xDataForChart: string;
  ndxOfelevationDataOptionsForHeight: number;
  func: string;
  description: string;
  querySql: string;
  whereClause: string;
  message: string;
  isWarning: boolean;
  showMessage: boolean;
  size: number;
  recCnt: number;
  xLegend: string;
  [key: string]: any;
}

export const useChartStore = defineStore('chartStore', {
  state: () => ({
    stateByReqId: {} as Record<string, ChartState>, // Dynamic state keyed by reqIdStr
  }),

  actions: {
    // Initialize a state for a reqIdStr if it doesn't exist
    ensureState(reqIdStr: string) {
      if (!this.stateByReqId[reqIdStr]) {
        this.stateByReqId[reqIdStr] = {
            currentFile: '',
            min_x: 0,
            max_x: 0,
            min_y: 0,
            max_y: 0,
            elevationDataOptions: [ 'not_set' ],
            yDataForChart: [],
            xDataForChart: 'x_atc',
            ndxOfelevationDataOptionsForHeight: 0,
            func: '',
            description: 'description here',
            querySql: '',
            whereClause: '',
            message: 'Failed to load data. Please try again later.',
            isWarning: false,
            showMessage: false,
            size: 0,
            recCnt: 0,
            selectedAtl03YapcColorMap: { name: 'viridis', value: 'viridis' },
            xLegend: 'Meters',
        };
      }
    },
    setMinX(reqIdStr: string, min_x: number) {
        this.ensureState(reqIdStr);
        this.stateByReqId[reqIdStr].min_x = min_x;
    },
    getMinX(reqIdStr: string) {
        return this.stateByReqId[reqIdStr].min_x;
    },
    setMaxX(reqIdStr: string, max_x: number) {
        this.ensureState(reqIdStr);
        this.stateByReqId[reqIdStr].max_x = max_x;
    },
    getMaxX(reqIdStr: string) {
        return this.stateByReqId[reqIdStr].max_x;
    },
    setFileName(reqIdStr: string, fileName: string) {
        this.ensureState(reqIdStr);
        this.stateByReqId[reqIdStr].currentFile = fileName;
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
        return this.stateByReqId[reqIdStr].whereClause;
    },
    // Update scatter plot count for a reqIdStr
    updateScatterPlot(reqIdStr: string) {
      this.ensureState(reqIdStr);
      this.stateByReqId[reqIdStr].updateScatterPlotCnt += 1;
    },

    // Set and get symbol size for a specific function
    setSymbolSize(reqIdStr: string, func: string, size: number) {
      this.ensureState(reqIdStr);
      if (func.includes('atl03sp')) {
        this.stateByReqId[reqIdStr].atl03spSymbolSize = size;
      } else if (func.includes('atl03vp')) {
        this.stateByReqId[reqIdStr].atl03vpSymbolSize = size;
      } else if (func.includes('atl06')) {
        this.stateByReqId[reqIdStr].atl06SymbolSize = size;
      } else if (func.includes('atl08')) {
        this.stateByReqId[reqIdStr].atl08SymbolSize = size;
      }
    },

    getSymbolSize(reqIdStr: string, func: string): number {
      this.ensureState(reqIdStr);
      if (func.includes('atl03sp')) {
        return this.stateByReqId[reqIdStr].atl03spSymbolSize;
      } else if (func.includes('atl03vp')) {
        return this.stateByReqId[reqIdStr].atl03vpSymbolSize;
      } else if (func.includes('atl06')) {
        return this.stateByReqId[reqIdStr].atl06SymbolSize;
      } else if (func.includes('atl08')) {
        return this.stateByReqId[reqIdStr].atl08SymbolSize;
      }
      return 5; // Default value
    },
    getNdxOfelevationDataOptionsForHeight(reqIdStr: string) {
        this.ensureState(reqIdStr);
        return this.stateByReqId[reqIdStr].ndxOfelevationDataOptionsForHeight;
    },
    getElevationDataOptions(reqIdStr: string) : string[] {
        this.ensureState(reqIdStr);
        return this.stateByReqId[reqIdStr].elevationDataOptions;
    },
    async setElevationDataOptionsFromFieldNames(reqIdStr: string,fieldNames: string[]) {
        this.ensureState(reqIdStr);
        //console.log('setElevationDataOptionsFromFieldNames reqIdStr:',reqIdStr, ' fieldNames:',fieldNames);
        this.stateByReqId[reqIdStr].elevationDataOptions = fieldNames;
        const heightFieldname = await getHeightFieldname(Number(reqIdStr));
        const ndx = fieldNames.indexOf(heightFieldname);
        this.stateByReqId[reqIdStr].ndxOfelevationDataOptionsForHeight = ndx;
        this.setYDataForChart(reqIdStr,[this.stateByReqId[reqIdStr].elevationDataOptions[ndx]]);

    },
    getYDataForChart(reqIdStr: string): string[] {
        this.ensureState(reqIdStr);
        return this.stateByReqId[reqIdStr].yDataForChart;
    },
    setYDataForChart(reqIdStr: string,yDataForChart: string[]): void {
        this.ensureState(reqIdStr);
        this.stateByReqId[reqIdStr].yDataForChart = yDataForChart;
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
        if (func.includes('atl03')) {
            this.setXDataForChart(reqIdStr,'x_atc');
        if (func.includes('atl03vp')) {
            this.setXDataForChart(reqIdStr,'segment_dist_x');
        }
        } else if (func.includes('atl06')) {
            this.setXDataForChart(reqIdStr,'x_atc');
        } else if (func.includes('atl08')) {
            this.setXDataForChart(reqIdStr,'x_atc');
        } else {
            console.error('setXDataForChartFromFunc() unknown function:', func);
        }
    },
    getCurrentFile(reqIdStr: string) {
        this.ensureState(reqIdStr);
        return this.stateByReqId[reqIdStr].currentFile;
    },
    getFunc(reqIdStr: string) {
        this.ensureState(reqIdStr);
        return this.stateByReqId[reqIdStr].func;
    },
    setFunc(reqIdStr: string,func: string) {
        this.ensureState(reqIdStr);
        this.stateByReqId[reqIdStr].func = func;
    },
    setShowMessage(reqIdStr: string,showMessage: boolean) { 
        this.ensureState(reqIdStr);
        this.stateByReqId[reqIdStr].showMessage = showMessage;
    },
    getShowMessage(reqIdStr?: string): boolean {
        if (reqIdStr) {
            this.ensureState(reqIdStr);
            return this.stateByReqId[reqIdStr]?.showMessage ?? false;
        } else {
            // Use Object.values to get all state objects and check the logical OR of their `showMessage` property
            return Object.values(this.stateByReqId).some(state => state.showMessage);
        }
    },
    setMessage(reqIdStr: string,message: string) {
        this.ensureState(reqIdStr);
        this.stateByReqId[reqIdStr].message = message;
    },
    getMessage(reqIdStr: string) {
        return this.stateByReqId[reqIdStr].message;
    },
    setIsWarning(reqIdStr: string,isWarning: boolean) {
        this.ensureState(reqIdStr);
        this.stateByReqId[reqIdStr].isWarning = isWarning;
    },
    getIsWarning(reqIdStr: string) {
        return this.stateByReqId[reqIdStr].isWarning;
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


    // Generic property getter
    getProperty(reqIdStr: string, key: keyof ChartState) {
      this.ensureState(reqIdStr);
      return this.stateByReqId[reqIdStr][key];
    },

    // Generic property setter
    setProperty(reqIdStr: string, key: keyof ChartState, value: any) {
      this.ensureState(reqIdStr);
      this.stateByReqId[reqIdStr][key] = value;
    },

  },
});
