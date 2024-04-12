import { defineStore } from 'pinia';
import { type ReqParams, type NullReqParams } from '@/stores/reqParamsStore';
import { type SrTimeDelta } from '@/composables/SrMapUtils';

export interface Job {
  id: number;
  star?: boolean;
  status?: string;
  func?: string;
  parameters?: ReqParams;
  elapsed_time?: SrTimeDelta;
};

export const useJobsStore = defineStore('jobs', {
  state: () => ({
    currentJobId: 0,
    jobs: [] as Job[],
    columns: [
      { field: 'id', header: 'ID' },
      { field: 'status', header: 'Status' },
      { field: 'func', header: 'Function' },
      { field: 'parameters', header: 'Parameters' },
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
    createNewJob(): Job {
      // Determine the new jobId as one more than the current maximum jobId
      const newJobId = this.jobs.reduce((max, job) => Math.max(max, job.id), 0) + 1;
    
      // Define a new job with blank/default values
      const newJob: Job = {
        id: newJobId,
        star: false,
        status: 'Pending',  // or any other default status like 'New' or 'Unstarted'
        func: '',           // assuming no default function
        parameters: {} as NullReqParams,     // assuming an empty object for default parameters
        elapsed_time: {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0
        }
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
      if (jobIndex !== -1) {
        // Job exists, so update it with provided parameters
        this.jobs[jobIndex] = {
          ...this.jobs[jobIndex],
          ...restParams
        };
      } else {
        // jobId does not exist, handle accordingly
        console.error(`Job with ID ${id} does not exist.`);
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
