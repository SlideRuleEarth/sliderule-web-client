import { getScatterOptions } from '@/workers/workerUtils';
import { type SrScatterOptionsParms } from '@/utils/parmUtils';
import type { SopWorkerCmdMsg,SopWorkerRspMsg } from './workerUtils';

onmessage = async (event) => {
    try {    
        //console.log('optionsWorker received event:', event); 
        const cmd:SopWorkerCmdMsg = JSON.parse(event.data);
        //console.log('optionsWorker received cmd:', cmd);
        const parms = cmd.parms as SrScatterOptionsParms;
        console.log('optionsWorker received parms:', parms);
        const scatterOptions = await getScatterOptions(parms);
        if(scatterOptions.error) {
            console.error('optionsWorker scatterOptions error:', scatterOptions.error);
        }
        if(scatterOptions.series[0].data.length > 0) {
            console.log('optionsWorker scatterOptions:', scatterOptions);
            const rsp:SopWorkerRspMsg = { scatterOptions: scatterOptions };
            console.log('optionsWorker postMessage rsp:', rsp);   
            postMessage(rsp);
        } else {
            console.warn('optionsWorker scatterOptions empty:', scatterOptions);
            const rsp:SopWorkerRspMsg = { scatterOptions: null };
            console.log('optionsWorker postMessage rsp:', rsp);   
            postMessage(rsp);
        }
    } catch (error) {
        console.error('Error in worker:', error);
        postMessage({ scatterOptions: null, error: error instanceof Error ? error.message : 'Unknown error' });
    }
};