import { defineStore } from 'pinia';
import { srTimeDelta, srTimeDeltaString } from '@/composables/SrMapUtils';
import { db, type Request } from '@/composables/db';
import { liveQuery } from 'dexie';


export const useReqsStore = defineStore('reqs', {
  state: () => ({
    currentReqId: '' as string,
    reqs: [] as Request[],
    reqIsLoading: {} as { [reqId: number]: boolean },
    columns: [
      { field: 'req_id', header: 'ID', tooltip: 'Unique ID' },
      { field: 'status', header: 'Status', tooltip: 'Request Status' },
      { field: 'func', header: 'Function', tooltip: 'Function Used in Request'},
      { field: 'parameters', header: 'Parameters', tooltip: 'Request Parameters'},
      { field: 'elapsed_time', header: 'Elapsed Time', tooltip: 'Time taken to complete the request'},
    ],
    error_in_req: [] as boolean[],
    liveQuerySubscription: null as any,
    msg:'ready'
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
    async createNewReq(): Promise<Request> {
      // Get the new reqId from the db
      const newReqId = await db.addPendingRequest(); // Await the promise to get the new req_id
      console.log('createNewReq() newReqId:', newReqId);
      await this.fetchReqs();  // Fetch the updated requests from the db
      console.log(`New req created with ID ${this.reqs[newReqId]}.`);
      this.error_in_req[newReqId-1] = false;
      return this.reqs[newReqId-1];  // array is zero based db is 1 based
    },
    setMsg(msg: string) {
      this.msg = msg;
    },
    async updateReq(updateParams: Partial<Request>): Promise<void> {
      const { req_id, start_time, end_time, ...restParams } = updateParams;
      console.log('updateReq-->updateParams:', updateParams);
      try{
        if(!req_id) throw new Error('Request ID is required to update a request.');
        this.fetchReqs();
        const reqIndex = this.reqs.findIndex(req => req.req_id === req_id);
        console.log('req_id:',req_id,' is reqs[',reqIndex,']:', this.reqs[reqIndex])
    
        let checked_st = start_time;
        if(!checked_st){
          checked_st = this.reqs[reqIndex].start_time;
          if(!checked_st){
            checked_st = new Date().toISOString();
          }
        }
        let checked_et = end_time;
        if(!checked_et){
          checked_et = this.reqs[reqIndex].end_time;
          if(!checked_et){
            checked_et = new Date().toISOString();
          }
        }
        const updatedReq = {
          ...updateParams,
          elapsed_time:  srTimeDeltaString(srTimeDelta(new Date(checked_st), new Date(checked_et)))
        };
        if(this.error_in_req[reqIndex] && (updatedReq.status != 'error')){
          // received records from the server after an error, ignore status updates
          console.log('Ignoring status update for request that has an error; ID:', req_id, ' ignored->',updatedReq, ' as it was in error state');
          return;
        } else {
          console.log(`Request with ID ${req_id}  to be updated with:`, updatedReq);
        }
        await db.updateRequest(req_id, updatedReq);
      } catch (error) {
        console.error(`Failed to update request with ID ${req_id}:`, error);
        throw error; // Rethrowing the error for further handling if needed
      }
    },

    async deleteReq(reqId: number): Promise<void>{
      try {
        await db.deleteRequest(reqId);
        console.log('Request deleted successfully');
      } catch (error) {
        console.error('Error deleting request:', error);
      }
    
    },
    async fetchReqs(): Promise<void> {
      try {
        this.reqs = await db.table('requests').toArray();
        console.log('Requests fetched successfully:', this.reqs);
      } catch (error) {
        console.error('Error fetching requests:', error);
      }
    },
    watchReqTable() {
      const subscription = liveQuery(() => db.table('requests').toArray())
        .subscribe((updatedReqs) => {
          this.reqs = updatedReqs;
          console.log('Requests updated:', this.reqs);
        });
    
      //Store the subscription; you need to unsubscribe later
      this.liveQuerySubscription = subscription;
    }
  }
});
