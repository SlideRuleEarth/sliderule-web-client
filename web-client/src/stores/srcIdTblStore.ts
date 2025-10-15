import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db as indexedDB } from '@/db/SlideRuleDb';
import { createDuckDbClient } from '@/utils/SrDuckDb';

export const useSrcIdTblStore = defineStore('srcIdTblStore', () => {
    const sourceTable = ref<string[]>([]);

    async function setSrcIdTblWithFileName(fileName: string) {
        const db = await createDuckDbClient();
        if (!db) {
            console.error(`Failed to create DuckDB client for file: ${fileName}`);
            sourceTable.value = [];
            return;
        }
        await db.insertOpfsParquet(fileName);
        try {
            const parsed = (await db.getJsonMetaDataForKey( 'meta',fileName)).parsedMetadata;
            if (parsed && parsed.srctbl && typeof parsed.srctbl === 'object') {
                // Convert object with numeric keys to an array
                sourceTable.value = Object.values(parsed.srctbl);
            } else {
                sourceTable.value = [];
                console.warn(`setSrcIdTblWithFileName: Missing or invalid 'srctbl' field in JSON for file: ${fileName}`);
            }
        } catch (error) {
            // If meta metadata is not found, just log and continue with empty source table
            console.warn(`setSrcIdTblWithFileName: Could not load 'meta' metadata for file: ${fileName}. Source table will be empty.`, error);
            sourceTable.value = [];
        }
    }

    async function setSourceTbl(reqId:number){
        const fileName = await indexedDB.getFilename(reqId);
        return setSrcIdTblWithFileName(fileName);
    }

    async function getUniqueSourceCount(req_id: number): Promise<number> {
        await setSourceTbl(req_id);
        return new Set(sourceTable.value).size;
    }

    async function getSourceTblForFile(fileName: string): Promise<string[]> {
        await setSrcIdTblWithFileName(fileName);
        return sourceTable.value;
    }

    return {
        sourceTable,
        getUniqueSourceCount,
        getSourceTblForFile,
    };
});