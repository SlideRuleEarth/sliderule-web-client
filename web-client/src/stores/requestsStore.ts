import { defineStore } from 'pinia';
import { db, type SrRequestRecord } from '@/db/SlideRuleDb';
import {type  NullReqParams } from '@/stores/reqParamsStore';
import { liveQuery } from 'dexie';
import type { SrMenuItem } from '@/components/SrMenuInput.vue';


export const useRequestsStore = defineStore('requests', {
  state: () => ({
    reqs: [] as SrRequestRecord[],
    reqIsLoading: {} as { [reqId: number]: boolean },
    columns: [
      { field: 'req_id', header: 'ID', tooltip: 'Unique ID' },
      { field: 'status', header: 'Status', tooltip: 'Request Status' },
      { field: 'func', header: 'Function', tooltip: 'Function Used in Request'},
      { field: 'parameters', header: 'Parameters', tooltip: 'Request Parameters'},
      { field: 'elapsed_time', header: 'Elapsed Time', tooltip: 'Time taken to complete the request'},
    ],
    error_in_req: [] as boolean[],
    liveRequestsQuerySubscription: null as any,
    msg:'ready',
    autoFetchError: false,
    autoFetchErrorMsg:'',
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
    getConsoleMsg(){
      return this.msg;
    },
    async createNewSrRequestRecord(): Promise<SrRequestRecord | null>  {
      // Get the new reqId from the db
      console.log('createNewSrRequestRecord()');
      const newReqId = await db.addPendingRequest(); // Await the promise to get the new req_id
      console.log('createNewSrRequestRecord() newReqId:', newReqId);
      if(newReqId){
        this.reqs.push({req_id: newReqId, status: 'pending', func: '', parameters: {} as NullReqParams, start_time: new Date(), end_time: new Date(), elapsed_time: ''});
        await this.fetchReqs();  // Fetch the updated requests from the db
        const newReq = this.getReqById(newReqId);
        console.log('New req created:', newReq);
        return newReq;
      } else {
        const errorMsg = 'Error creating new request, undefined reqId ?';
        console.error(errorMsg);
        throw new Error(errorMsg);
      } 
    },
    setMsg(msg: string) {
      this.msg = msg;
    },
    // async updateReq(updateParams: Partial<SrRequestRecord>): Promise<void> {
    //   const { req_id, ...restParams } = updateParams;
    //   console.log('updateReq-->updateParams:', updateParams);
    //   try{
    //     if(!req_id) throw new Error('SrRequestRecord ID is required to update a request.');
    //     this.fetchReqs();
    //     const reqIndex = this.reqs.findIndex(req => req.req_id === req_id);
    //     console.log('req_id:',req_id,' is reqs[',reqIndex,']:', this.reqs[reqIndex])
    //     const st = this.reqs[reqIndex].start_time;
    //     if(st){
    //       const st_date = new Date(st);
    //       if (!(st_date instanceof Date )){
    //         console.error('start_time is not a Date object st:', st, ' st_date:', st_date);
    //         //throw new Error('start_time is not a Date object');
    //       }
          
    //       console.log('start_time is set for request:', req_id, ' st:',st_date, ' setting elapsed_time');
    //       updateParams.elapsed_time = srTimeDeltaString(srTimeDelta(st_date, new Date()));
    //     } else {
    //       console.error('start_time is not set for request:', req_id, ' setting elapsed_time to empty string')
    //       updateParams.elapsed_time = '';
    //     }
        
    //     if(this.error_in_req[reqIndex] && (updateParams.status != 'error')){
    //       // received records from the server after an error, ignore status updates
    //       console.log('Ignoring status update for request that has an error; ID:', req_id, ' ignored->',updateParams, ' as it was in error state');
    //       return;
    //     } 
    //     console.log('final updateParams:', updateParams);
    //     await db.updateRequest(req_id, updateParams);
    //     if(updateParams.status == 'error'){
    //       this.error_in_req[reqIndex] = true;
    //     }
    //   } catch (error) {
    //     console.error('Failed to update request using params:', updateParams,' with ID:',req_id,' error:', error);
    //     throw error; // Rethrowing the error for further handling if needed
    //   }
    // },

    async deleteReq(reqId: number): Promise<void>{
      try {
        await db.deleteRequest(reqId);
        console.log('SrRequestRecord deleted successfully');
      } catch (error) {
        console.error('Error deleting request:', error);
      }
    
    },
    async fetchReqs(): Promise<void> {
      try {
        this.reqs = await db.table('requests').orderBy('req_id').reverse().toArray();
        console.log('Requests fetched successfully:', this.reqs);
      } catch (error) {
        console.error('Error fetching requests:', error);
      }
    },
    async fetchReqIds(): Promise<number[]> {
      try {
        const reqIds = await db.getRequestIds();
        console.log('SrRequestRecord IDs fetched successfully:', reqIds);
        return reqIds;
      } catch (error) {
        console.error('Error fetching request IDs:', error);
        return [];
      }
    },
    async getMenuItems(): Promise<SrMenuItem[]> {
      const fetchedReqIds = await this.fetchReqIds();
      return fetchedReqIds.map((id: number) => {
          return {name: id.toString(), value: id.toString()};
      });
    },
    watchReqTable() {
      const subscription = liveQuery(() => db.table('requests').toArray())
      .subscribe({
        next: (updatedReqs) => {
          this.reqs = updatedReqs;
          this.autoFetchError = false; // Clear any previous error messages
          this.autoFetchErrorMsg = ''; // Clear any previous error messages
          console.log('Requests automagically updated:', this.reqs);
        },
        error: (err) => {
          console.error('Failed to update requests due to:', err);
          // Optionally, update state to reflect the error
          this.msg = 'Error fetching requests'; // use this to display an error message in UI if needed
          this.autoFetchError = true; // Set a flag to indicate an error occurred
          this.autoFetchErrorMsg = 'Failed to fetch requests'; // Set a user-friendly error message
        }
      });
      //Store the subscription; you need to unsubscribe later
      this.liveRequestsQuerySubscription = subscription;
    },

  }
});
