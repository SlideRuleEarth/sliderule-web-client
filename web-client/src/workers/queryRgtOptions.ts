import { createDuckDbClient, type QueryResult } from '@/utils/SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';

self.onmessage = async (event) => {
    const { req_id } = event.data;
    const startTime = performance.now();
    const rgts = [];

    try {
        const fileName = await indexedDb.getFilename(req_id); // Ensure IndexedDB support in worker
        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);
        const query = `SELECT DISTINCT rgt FROM '${fileName}' ORDER BY rgt ASC`;
        const queryResult = await duckDbClient.query(query);

        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    rgts.push(row.rgt);
                }
            }
        }

        const endTime = performance.now();
        console.log(`Query execution time: ${endTime - startTime} ms`);

        // Send the result back to the main thread
        self.postMessage({ rgts });
    } catch (error) {
        console.error('Error:', error);
        self.postMessage({ error });
    }
};
