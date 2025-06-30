import { defineStore } from 'pinia';
import { db, DEFAULT_DESCRIPTION, type SrRequestRecord } from '@/db/SlideRuleDb';
import {type  NullReqParams } from '@/types/SrTypes';
import { liveQuery } from 'dexie';
import type { SrMenuNumberItem } from "@/types/SrTypes";
import { findParam } from '@/utils/parmUtils';
import { useSrToastStore } from './srToastStore';
import type { TreeNode } from 'primevue/treenode';

export const useRequestsStore = defineStore('requests', {
  state: () => ({
    reqs: [] as SrRequestRecord[],
    reqIsLoading: {} as { [reqId: number]: boolean },
    error_in_req: [] as boolean[],
    liveRequestsQuerySubscription: null as any,
    svrMsgCnt: 0,
    svrMsg:'waiting...',
    consoleMsg:'ready',
    autoFetchError: false,
    autoFetchErrorMsg:'',
    helpfulReqAdviceCnt: 2,
  }),
  getters: {
    getReqById: (state) => {
      return (reqId: number) => {
        const reqIndex = state.reqs.findIndex(req => req.req_id === reqId);
        return reqIndex !== -1 ? state.reqs[reqIndex] : null;
      };
    }
  },
  actions: {
    toggleStar(reqId: number) {
      const reqIndex = this.reqs.findIndex(req => req.req_id === reqId);
      console.log(`Toggling star for req ${reqId} using reqIndex:${reqIndex}.`);
      if (reqIndex !== -1) {
        this.reqs[reqIndex].star = !this.reqs[reqIndex].star;
      }
    },
    setConsoleMsg(msg: string) {
      this.consoleMsg = msg;
    },
    getConsoleMsg(){
      return this.consoleMsg;
    },
    setSvrMsgCnt(cnt: number) {
      this.svrMsgCnt = cnt;
    },
    getSvrMsgCnt(){
      return this.svrMsgCnt;
    },
    incrementSrMsgCnt(): number {
      return this.svrMsgCnt++;
    },
    setSvrMsg(msg: string) {
      this.svrMsg = msg;
    },
    getSvrMsg(){
      return this.svrMsg;
    },    
    async createNewSrRequestRecord(): Promise<SrRequestRecord | null>  {
      // Get the new reqId from the db
      console.log('createNewSrRequestRecord()');
      const newReqId = await db.addPendingRequest(); // Await the promise to get the new req_id
      console.log('createNewSrRequestRecord() newReqId:', newReqId);
      if(newReqId){
        try{
          this.reqs.push({req_id: newReqId, status: 'pending', func: '', cnt:0, parameters: {} as NullReqParams, start_time: new Date(), end_time: new Date(), elapsed_time: ''});
          await this.fetchReqs();  // Fetch the updated requests from the db
          const newReq = this.getReqById(newReqId);
          console.log('New req created:', newReq);
          return newReq;
        } catch (error) {
          console.error('createNewSrRequestRecord Failed to create new request:', error);
          throw error;
        }
      } else {
        const errorMsg = 'createNewSrRequestRecord Error creating new request, undefined reqId ?';
        console.error(errorMsg);
        throw new Error(errorMsg);
      } 
    },
    async deleteReq(reqId: number): Promise<boolean>{
      let deleted=true;
      try {
        await db.deleteRequest(reqId);
      } catch (error) {
        console.error('Error deleting request:', error);
        deleted=false;
      }
      try{
        await db.deleteRequestSummary(reqId);
        console.log(`reqId:${reqId} deleted successfully`);
      } catch (error) {
        console.error(`Error with deleteRequestSummary when deleting reqId:${reqId}`, error);
        deleted=false;
      }
      try {
        await db.removeRunContext(reqId);

      } catch (error) {
        console.error(`Error with removeRunContext when deleting reqId:${reqId}`, error);
        deleted=false;
      }
      return deleted;
    },
    async deleteAllReqs(): Promise<void>{
      try {
        await db.deleteAllRequests();
        await db.deleteAllRequestSummaries();
        console.log('All SrRequestRecords deleted successfully');
      } catch (error) {
        console.error('Error deleting all requests:', error);
        throw error;
      }
    },
    async has_checksum(req_id: number): Promise<boolean> {
      const params = await db.getReqParams(req_id);
      //console.log('has_checksum params:', params);
      return findParam(params, 'with_checksum');
    },

    async fetchReqs(): Promise<void> {
      try {
        this.reqs = await db.table('requests').orderBy('req_id').reverse().toArray();
        //console.log('Requests fetched successfully:', this.reqs);
      } catch (error) {
        console.error('Error fetching requests:', error);
        throw error;
      }
    },
    async fetchReqIds(): Promise<number[]> {
      try {
        const reqIds = await db.getRequestIds();
        //console.log('SrRequestRecord IDs fetched successfully:', reqIds);
        return reqIds;
      } catch (error) {
        console.error('Error fetching request IDs:', error);
        return [];
      }
    },
    async getNumReqs(): Promise<number> {
      const reqIDs = await this.fetchReqIds();
      return reqIDs.length;
    },   
    async getMenuItems(): Promise<SrMenuNumberItem[]> {
      const fetchedReqIds = await this.fetchReqIds();
    
      // Sort reqIds in descending order
      fetchedReqIds.sort((a, b) => b - a);
    
      // 1. Build an array of items
      const items = await Promise.all(
        fetchedReqIds.map(async (id: number) => {
          const status = await db.getStatus(id);
          const funcStr = await db.getFunc(id);
          const rc = await db.getRunContext(id);
    
          const parentReqId = rc?.parentReqId; // Optional parentReqId
          // Calculate spaces based on the number of digits in parentReqId
          const parentReqIdSpaces = parentReqId
            ? '-'.repeat(parentReqId.toString().length)
            : '';
    
          // Only include items you care about
          if (status === 'success' || status === 'imported') {
            return {
              label: `${id.toString()} - ${funcStr}`,
              value: id,
              parentReqId: parentReqId,
              api: funcStr,
            } as SrMenuNumberItem; // Explicitly cast to SrMenuNumberItem
          }
    
          // Return undefined if it doesn't match your criteria
          return undefined;
        })
      );
    
      // 2. Filter out undefined safely
      const filteredItems = items.filter(
        (item): item is SrMenuNumberItem => item !== undefined
      );
    
      // 3. Build a map: parentReqId -> array of children
      const childrenMap = new Map<number | undefined, SrMenuNumberItem[]>();
      for (const item of filteredItems) {
        const parentId = item.parentReqId ?? undefined; // Explicitly allow undefined keys
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(item);
      }
    
      // 4. Recursively build a flat list where each parent is followed by its children
      const finalItems: SrMenuNumberItem[] = [];
    
      function buildHierarchy(parentId: number | undefined) {
        const children = childrenMap.get(parentId) || [];
        // Sort children in descending order by `value` (reqId)
        children.sort((a, b) => b.value - a.value);
    
        for (const child of children) {
          finalItems.push(child);
          // Then recursively place child’s children below it
          buildHierarchy(child.value);
        }
      }
    
      // Start with “top-level” items (those whose parentReqId is undefined)
      buildHierarchy(undefined);
    
      // finalItems now has parents first, children right after the respective parent
      return finalItems;
    },
            
    watchReqTable() {
      const subscription = liveQuery(() => db.table('requests').orderBy('req_id').reverse().toArray())
      .subscribe({
        next: (updatedReqs) => {
          this.reqs = updatedReqs;
          this.autoFetchError = false; // Clear any previous error messages
          this.autoFetchErrorMsg = ''; // Clear any previous error messages
          //console.log('Requests automagically updated:', this.reqs);
        },
        error: (err) => {
          console.error('Failed to update requests due to:', err);
          // Optionally, update state to reflect the error
          this.consoleMsg = 'Error fetching requests'; // use this to display an error message in UI if needed
          this.autoFetchError = true; // Set a flag to indicate an error occurred
          this.autoFetchErrorMsg = 'Failed to fetch requests'; // Set a user-friendly error message
        }
      });
      //Store the subscription; you need to unsubscribe later
      this.liveRequestsQuerySubscription = subscription;
    },
    unWatchReqTable() {
      if (this.liveRequestsQuerySubscription) {
        this.liveRequestsQuerySubscription.unsubscribe();
      }
    },
    async displayHelpfulMapAdvice(msg: string): Promise<void> {
      if (await this.getNumReqs() < this.helpfulReqAdviceCnt) {
          useSrToastStore().info('Helpful Advice', msg);
      }
    },
    async displayHelpfulPlotAdvice(msg: string): Promise<void> {
        if (await this.getNumReqs() < this.helpfulReqAdviceCnt) {
            useSrToastStore().info('Helpful Advice', msg);
        }
    },
    async needAdvice(): Promise<boolean> {
      if (await useRequestsStore().getNumReqs() < useRequestsStore().helpfulReqAdviceCnt+2) {
        return true;
      }
      return false;
    },

    async getTreeTableNodes(onlySuccessful:boolean=true): Promise<TreeNode[]> {
      // 1) Get all request IDs in descending order:
      const fetchedReqIds = await this.fetchReqIds();
      fetchedReqIds.sort((a, b) => b - a);
    
      // 2) Pull from Dexie or wherever you store the data:
      const requestsData: { [id: number]: SrRequestRecord | null } = {};
      for (const reqId of fetchedReqIds) {
        requestsData[reqId] = await db.table('requests').get(reqId);
      }
    
      // 3) Build an array of raw “reqNodes,” each with its parentReqId:
      type ReqNode = {
        reqId: number;
        parentReqId?: number;
        data: SrRequestRecord;
      };
    
      const reqNodes: ReqNode[] = [];
      for (const id of fetchedReqIds) {
        const record = requestsData[id];
        const status = record?.status;
        if (onlySuccessful && (status !== 'success' && status !== 'imported')) {
          // Skip if you only want “success” or “imported”
          continue;
        }
        if (!record) continue;
    
        const rc = await db.getRunContext(id);
        const parentReqId = rc?.parentReqId; // Might be undefined for top-level
    
        reqNodes.push({
          reqId: id,
          parentReqId,
          data: {
            ...record,
          }
        });
      }
    
      // 4) Group children by parentReqId:
      const childrenMap = new Map<number | undefined, ReqNode[]>();
      for (const node of reqNodes) {
        const key = node.parentReqId ?? undefined;
        if (!childrenMap.has(key)) {
          childrenMap.set(key, []);
        }
        childrenMap.get(key)!.push(node);
      }
    
      // 5) Recursively transform into TreeNode objects with hierarchical keys:
      function buildTree(parentId: number | undefined, parentKey = ''): TreeNode[] {
        const children = childrenMap.get(parentId) || [];
        children.sort((a, b) => b.reqId - a.reqId); // Optional: sort
    
        return children.map((child, index) => {
          const currentKey = parentKey ? `${parentKey}-${index}` : `${index}`;
          const childNodes = buildTree(child.reqId, currentKey);
    
          return {
            key: currentKey,
            data: {
              reqId: child.reqId,
              status: child.data.status,
              func: child.data.func,
              description: child.data.description ?? '(No description)',
              cnt: child.data.cnt,
              num_bytes: child.data.num_bytes,
              elapsed_time: child.data.elapsed_time,
              parameters: child.data.parameters,
              svr_parms: child.data.svr_parms,
            },
            children: childNodes
          } as TreeNode;
        });
      }
    
      return buildTree(undefined);
    }
    
    // ...    
  }

});
