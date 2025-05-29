import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db as indexedDB } from '@/db/SlideRuleDb';
import { createDuckDbClient } from '@/utils/SrDuckDb';

export const useSrcIdTblStore = defineStore('srcIdTblStore', () => {
    const sourceTable = ref<string[]>([]);

    async function setSourceTbl(reqId:number){
        const fileName = await indexedDB.getFilename(reqId);
        const db = await createDuckDbClient();
        if (!db) {
            console.error(`Failed to create DuckDB client for file: ${fileName}`);
            sourceTable.value = [];
            return;
        }
        const parsed = (await db.getJsonMetaDataForKey( 'meta',fileName)).parsedMetadata;
        if (parsed && parsed.srctbl && typeof parsed.srctbl === 'object') {
            // Convert object with numeric keys to an array
            sourceTable.value = Object.values(parsed.srctbl);
        } else {
            sourceTable.value = [];
            console.warn("Missing or invalid 'srctbl' field in JSON.");
        }
    }

    return {
        sourceTable,
        setSourceTbl,
    };
});