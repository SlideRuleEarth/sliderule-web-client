import { parquetMetadata,parquetRead, parquetSchema, type FileMetaData } from 'hyparquet'
import { getHeightFieldname,getFieldNames,findHeightNdx,findLatNdx,findLongNdx,recurseTree,updateExtremeLatLon } from "./SrParquetUtils";
import { updateElLayerWithArray } from '@/utils/SrMapUtils';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { db } from '@/db/SlideRuleDb'; 
import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import type { ExtLatLon,ExtHMean } from '@/workers/workerUtils';



export async function hyparquetReadOrCacheSummary(req_id:number,height_fieldname:string) : Promise<SrRequestSummary | undefined>{
    const opfsRoot = await navigator.storage.getDirectory();
    const filename = await db.getFilename(req_id);
    const fileHandle = await opfsRoot.getFileHandle(filename, { create: false });
    const file1 = await fileHandle.getFile();
    const arrayBuffer = await file1.arrayBuffer(); // Convert the file to an ArrayBuffer
    const summary = await db.getWorkerSummary(req_id);
    console.log('readOrCacheSummary req_id:',req_id,' summary:',summary);
    if (summary) {
        return summary;
    } else {
        let localExtLatLon = {minLat: 90, maxLat: -90, minLon: 180, maxLon: -180} as ExtLatLon;
        let localExtHMean = {minHMean: 100000, maxHMean: -100000, lowHMean: 100000, highHMean: -100000} as ExtHMean;
        const chunkSize = 200000;
        let rowStart = 0;
        let rowEnd = chunkSize;
        let hasMoreData = true;
        let datalen = 0;
        try{
            while (hasMoreData) { // First find extreme values for legend
                console.log('readOrCacheSummary rowStart:',rowStart,' rowEnd:',rowEnd,' height_fieldname:',height_fieldname);
                await parquetRead({
                    file: arrayBuffer,
                    columns: ['longitude', 'latitude', height_fieldname],
                    rowStart: rowStart,
                    rowEnd: rowEnd,
                    onComplete: data => {
                        console.log('data.length:',data.length,'data:', data);
                        const updatedExtremes = updateExtremeLatLon(data as [any,any,any], localExtLatLon, localExtHMean);
                        localExtLatLon = updatedExtremes.extLatLon;
                        localExtHMean = updatedExtremes.extHMean;
                        hasMoreData = data.length === chunkSize;
                        datalen += data.length;
                    }
                });
                rowStart += chunkSize;
                rowEnd += chunkSize;
            }
        } catch (error) {
            console.error('readOrCacheSummary error:',error);
            throw error;
        }
        if (datalen > 0) {
            await db.addNewSummary({req_id:req_id, extLatLon: localExtLatLon, extHMean: localExtHMean});
        } else {
            const errMsg = `readOrCacheSummary datalen is 0 for req_id:${req_id}`;
            console.error(errMsg);
            throw new Error(errMsg);
        }
        return await db.getWorkerSummary(req_id);
    }
}
export const readOpsfFileHeader = async (height_fieldname:string, arrayBuffer:ArrayBuffer) => {
    try{
        const metadata = parquetMetadata(arrayBuffer);

        console.log('processOpfsFile metadata:',metadata);
        const schema = parquetSchema(metadata);
        console.log('processOpfsFile schema:',schema);

        const allFieldNameTypes = recurseTree(schema);
        const allFieldNames = getFieldNames(allFieldNameTypes);
        const lonNdx = findLongNdx(allFieldNameTypes);
        const latNdx = findLatNdx(allFieldNameTypes);
        const hMeanNdx = findHeightNdx(allFieldNameTypes,height_fieldname);
        const numRows = metadata.num_rows;
        //console.log('readAndUpdateElevationData lonNdx:',lonNdx,' latNdx:',latNdx,' hMeanNdx:',hMeanNdx);
        return {metadata,allFieldNames, hMeanNdx, latNdx, lonNdx, numRows};
    } catch (error) { 
        const errorMsg = `readOpsfFileHeader Failed with error: ${error}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
}
export const hyparquetReadAndUpdateElevationData = async (req_id:number) => {


    try{
        console.log('readAndUpdateElevationData req_id:',req_id);
        const height_fieldname = await getHeightFieldname(req_id);
        const fileName = await db.getFilename(req_id);
        const opfsRoot = await navigator.storage.getDirectory();
        //console.log('readAndUpdateElevationData opfsRoot:',opfsRoot);
        const fileHandle = await opfsRoot.getFileHandle(fileName, {create:false});
        //console.log('readAndUpdateElevationData fileHandle:',fileHandle);
        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer(); // Convert the file to an ArrayBuffer
        const header = await readOpsfFileHeader(height_fieldname,arrayBuffer);
        const numberOfRows = Number(header.numRows)-1;

        console.log('readAndUpdateElevationData header:',header);
        const summary = await hyparquetReadOrCacheSummary(req_id,height_fieldname);
        if(summary){
            useCurReqSumStore().setSummary(summary);
            
            if(useSrParquetCfgStore().getParquetReader().name === 'hyparquet'){
                const chunkSize = 1000000; 
                let rowStart = 0;
                let rowEnd = chunkSize;
                let hasMoreData = true;
                
                console.log('readAndUpdateElevationData numberOfRows:',numberOfRows, ' summary.extHMean:',summary.extHMean);
                console.log('header.allFieldNames:',header.allFieldNames,' header.hMeanNdx:',header.hMeanNdx,' header.lonNdx:',header.lonNdx,' header.latNdx:',header.latNdx);
                while (hasMoreData) { // now plot data with color extremes set
                    try{
                        rowEnd = Math.min(rowEnd, numberOfRows);
                        console.log('readAndUpdateElevationData rowStart:',rowStart,' rowEnd:',rowEnd);
                        const arrayBuffer2 = await file.arrayBuffer(); // Convert the file to an ArrayBuffer
                        await parquetRead({
                            file: arrayBuffer2,
                            //columns: header.allFieldNames,
                            //columns: ['longitude', 'latitude', height_fieldname],
                            rowStart: rowStart,
                            rowEnd: rowEnd,
                            metadata: header.metadata,
                            onComplete: data => {
                                console.log('data.length:',data.length,'data:', data);
                                updateElLayerWithArray(data as [][], header.hMeanNdx, header.lonNdx, header.latNdx, summary.extHMean, header.allFieldNames);
                                //updateElLayerWithArray(data as [][], 2, 0, 1, summary.extHMean, ['longitude', 'latitude', height_fieldname]);
                                //hasMoreData = data.length === chunkSize;
                                hasMoreData = false;
                            }
                        });
                    } catch (error) {
                        console.error('readAndUpdateElevationData error:',error);
                        throw error;
                    }
                    rowStart += chunkSize;
                    rowEnd += chunkSize;
                    //console.log('readAndUpdateElevationData rowStart:',rowStart,' rowEnd:',rowEnd,' hasMoreData:',hasMoreData, ' chunkSize:',chunkSize, ' datalen:',datalen);
                }
            } else {
                console.error('readAndUpdateElevationData parquetReader:',useSrParquetCfgStore().getParquetReader().name,' not supported');
            }
        } else {
            console.error('readAndUpdateElevationData summary is undefined');
        }
    } catch (error) {
        const errorMsg = `readAndUpdateElevationData Failed with error: ${error}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
}