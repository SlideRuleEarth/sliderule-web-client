// Define the structure of the message received by the worker
interface OptionsWorkerMsg {
    parms: SrScatterOptionsParms;
}

// Define the structure of the message posted by the worker
interface OptionsWorkerRsp {
    scatterOptions: any;
}

// Import any required functions or modules
import { getScatterOptions } from '@/utils/SrDuckDbUtils';
import { type SrScatterOptionsParms } from '@/utils/parmUtils';
self.addEventListener('message', async (event: MessageEvent<OptionsWorkerMsg>) => {
const msg = event.data as OptionsWorkerMsg;

try {
    // Perform the long-running data fetch here
    const scatterOptions = await getScatterOptions(msg.parms);
    const response: OptionsWorkerRsp = { scatterOptions };
    
    self.postMessage(response);
} catch (error) {
    console.error('Error in worker:', error);
    self.postMessage({ scatterOptions: null });
}
});
