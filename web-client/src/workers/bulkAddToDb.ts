import { db } from "@/db/SlideRuleDb";
import { type Elevation } from "@/db/SlideRuleDb";
import { c } from "node_modules/vite/dist/node/types.d-aGj9QkWt";

export type BulkAddToDbWorkerMessage = {
    req_id: number;
    recs: Elevation[];
}

onmessage = async (e: MessageEvent) => {
    console.log('BulkAddToDbWorker onmessage:', e);
    const msg: BulkAddToDbWorkerMessage = JSON.parse(e.data);
    try{
        console.log('BulkAddToDbWorkerMessage:', msg);
        await db.bulkAddElevations(msg.req_id,msg.recs);
        postMessage({ req_id: msg.req_id, status: 'success', msg: 'Bulk elevations added successfully!' });
    } catch (error) {
        postMessage({ req_id: msg.req_id, status: 'error', error: { type: 'bulkAddToDb', code: 'bulkAddToDb', message: error } });
    }
}