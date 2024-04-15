import { defineStore } from 'pinia';
import { type ReqParams, type NullReqParams } from '@/stores/reqParamsStore';
import { srTimeDelta, srTimeDeltaString } from '@/composables/SrMapUtils';
import { db } from '@/composables/db';

export interface Job {
  id: number; // req_id from the Requests table in the Dexie database
  star?: boolean;
  status?: string;
  func?: string;
  parameters?: ReqParams;
  startTime?: Date;  // Include start time for each job
  endTime?: Date;    // Include end time for each job
  elapsed_time?: string;
};

export const useJobsStore = defineStore('jobs', {
  state: () => ({
    currentJobId: '' as string,
    jobs: [] as Job[],
    columns: [
      { field: 'id', header: 'ID' },
      { field: 'status', header: 'Status' },
      { field: 'func', header: 'Function' },
      { field: 'parameters', header: 'Parameters' },
      { field: 'elapsed_time', header: 'Elapsed Time'}
    ],
    msg:'ready'
  }),
  getters: {
    getJobById: (state) => {
      return (jobId: number) => {
        const jobIndex = state.jobs.findIndex(job => job.id === jobId);
        return jobIndex !== -1 ? state.jobs[jobIndex] : null;
      };
    }
  },
  actions: {
    toggleStar(jobId: number) {
      const jobIndex = this.jobs.findIndex(job => job.id === jobId);
      console.log(`Toggling star for job ${jobId} using jobIndex:${jobIndex}.`);
      if (jobIndex !== -1) {
        this.jobs[jobIndex].star = !this.jobs[jobIndex].star;
      }
    },
    getConsoleMsg(){
      return this.msg;
    },
    async createNewJob(): Promise<Job> {
      // Determine the new jobId as one more than the current maximum jobId
      //const newJobId = this.jobs.reduce((max, job) => Math.max(max, job.id), 0) + 1;
      const newJobId = await db.addPendingRequest(); // Await the promise to get the new req_id
      const startTime = new Date();  // Capture the start time for this job
      const endTime = new Date();    // Placeholder end time for this job

      // Define a new job with blank/default values
      const newJob: Job = {
        id: newJobId,
        star: false,
        status: 'Pending',  // or any other default status like 'New' or 'Unstarted'
        func: '',           // assuming no default function
        parameters: {} as NullReqParams,     // assuming an empty object for default parameters
        startTime,  // Store the start time
        endTime,    // Store the end time
        elapsed_time: srTimeDeltaString(srTimeDelta(startTime, endTime))  // Calculate and format elapsed time
      };
    
      // Add the new job to the jobs array
      this.jobs.push(newJob);
      console.log(`New job created with ID ${newJobId}.`);
      return newJob;  // Returning the new job might be useful for immediate use
    },
    setMsg(msg: string) {
      this.msg = msg;
    },
    updateJob(updateParams: Job): void {
      const { id, ...restParams } = updateParams;
      // Find the index of the job in the array
      const jobIndex = this.jobs.findIndex(job => job.id === id);
      console.log(`Updating job ${id} with parameters:`, restParams);
      // Job exists, so update it with provided parameters
      if (jobIndex !== -1) {
        // if status is provided and different from current status, update the state in the database
        if (restParams.status){
          if (restParams.status != this.jobs[jobIndex].status){
            db.updateRequestState(id, restParams.status);
          }
        }
        this.jobs[jobIndex] = {
          ...this.jobs[jobIndex],
          ...restParams
        };
      } else {
        // jobId does not exist, handle accordingly
        console.error(`Job with ID ${id} does not exist.`);
      }
      this.updateJobElapsedTime(id);  // Update the elapsed time for the job (if applicable
    },
    updateJobElapsedTime(jobId: number) {
      const jobIndex = this.jobs.findIndex(job => job.id === jobId);
      if (jobIndex !== -1) {
        const job = this.jobs[jobIndex];
        job.endTime = new Date();  // Update the end time
        if (job.startTime){
          job.elapsed_time = srTimeDeltaString(srTimeDelta(job.startTime, job.endTime));  // Recalculate elapsed time
        } else {
          console.error(`Job with ID ${jobId} has no start time.`);
        }
      } else {
        console.error(`Job with ID ${jobId} does not exist.`);
      }
    },
    deleteJob(jobId: number) {
      const jobIndex = this.jobs.findIndex(job => job.id === jobId);
      if (jobIndex !== -1) {
        // Remove the job from the array
        this.jobs.splice(jobIndex, 1);
        console.log(`Job with ID ${jobId} deleted.`);
      } else {
        // Log an error if the job ID does not exist
        console.error(`Job with ID ${jobId} does not exist and cannot be deleted.`);
      }
    },
  }
});
