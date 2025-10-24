import { useRequestsStore } from "@/stores/requestsStore";
import { db } from "@/db/SlideRuleDb";
import { deleteOpfsFile } from "@/utils/SrParquetUtils";
import { createLogger } from '@/utils/logger';

const logger = createLogger('StorageUtils');


const requestsStore = useRequestsStore();

export const cleanupDelAllRequests = async () => {
    const deletePromises = requestsStore.reqs.map(async (req) => {
        try {
            if (req.req_id) {
                const fn = await db.getFilename(req.req_id);
                await deleteOpfsFile(fn);
            } else {
                logger.error('Request id is missing for request', { req });
            }
        } catch (error) {
            logger.error('Failed to delete request', { reqId: req.req_id, error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    });

    await Promise.all(deletePromises);
    await requestsStore.deleteAllReqs();
}