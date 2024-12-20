import { defineStore } from 'pinia';
import { db, DEFAULT_DESCRIPTION, type SrRequestRecord } from '@/db/SlideRuleDb';
import {type  NullReqParams } from '@/sliderule/icesat2';
import { liveQuery } from 'dexie';
import type { SrMenuItem } from '@/components/SrMenuInput.vue';
import { findParam } from '@/utils/parmUtils';
import { useSrToastStore } from './srToastStore';

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
          this.reqs.push({req_id: newReqId, status: 'pending', func: '', parameters: {} as NullReqParams, start_time: new Date(), end_time: new Date(), elapsed_time: ''});
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
    async deleteReq(reqId: number): Promise<void>{
      try {
        await db.deleteRequest(reqId);
        await db.deleteRequestSummary(reqId);
        console.log('SrRequestRecord deleted successfully');
      } catch (error) {
        console.error('Error deleting request:', error);
        throw error;
      }
    
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
    async getMenuItems(): Promise<SrMenuItem[]> {
      const fetchedReqIds = await this.fetchReqIds();
      
      const promises = fetchedReqIds.map(async (id: number) => {
        const status = await db.getStatus(id);
        const funcStr = await db.getFunc(id);
        // const descr = await db.getDescription(id);
        // let truncatedDescr = '';
        // if (descr !== DEFAULT_DESCRIPTION) {
        //   truncatedDescr = descr.length > 10 ? descr.substring(0, 10) + '...' : descr;
        //   truncatedDescr = ' - ' + truncatedDescr;
        // }
        if ((status == 'success') || (status == 'imported')) {
          return { name: `${id.toString()} - ${funcStr}`, value: id.toString() };
        }
      });
    
      const results = await Promise.all(promises);
    
      // Filter out undefined values
      return results.filter((item): item is SrMenuItem => item !== undefined);
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
  }

});
