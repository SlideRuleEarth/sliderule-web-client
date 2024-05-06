import { db } from "@/db/SlideRuleDb";
import { type Elevation } from "@/db/SlideRuleDb";

export type BulkAddToDbMsg = {
    req_id: number;
    recs: Elevation[];
}

onmessage = async (e: MessageEvent) => {
    console.log('BulkAddToDbWorker onmessage:', e);
    const msg: BulkAddToDbMsg = e.data;
    try{
        console.log('BulkAddToDbMsg:', msg);
        await db.bulkAddElevations(msg.req_id,msg.recs);
        postMessage({ req_id: msg.req_id, status: 'success', msg: 'Bulk elevations added successfully!' });
    } catch (error) {
        postMessage({ req_id: msg.req_id, status: 'error', error: { type: 'bulkAddToDb', code: 'bulkAddToDb', message: error } });
    }
}