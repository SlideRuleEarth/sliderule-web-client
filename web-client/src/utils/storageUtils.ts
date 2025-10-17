import { useRequestsStore } from "@/stores/requestsStore";
import { db } from "@/db/SlideRuleDb";
import { deleteOpfsFile } from "@/utils/SrParquetUtils";


const requestsStore = useRequestsStore();

export const cleanupDelAllRequests = () => {
    requestsStore.reqs.forEach(async (req) => {
        try {
            if (req.req_id) {
                const fn = await db.getFilename(req.req_id);
                await deleteOpfsFile(fn);
            } else {
                console.error(`Request id is missing for request:`, req);
            }
        } catch (error) {
            console.error(`Failed to delete request for id:${req.req_id}`, error);
            throw error;
        }
    });
    requestsStore.deleteAllReqs();
}