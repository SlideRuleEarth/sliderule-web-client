import { defineStore } from 'pinia';
import { type ReqParams } from './reqParamsStore';

export interface Job {
  Star: boolean;
  ID: number;
  Status: string;
  func: string;
  parameters: ReqParams;
}

export const useJobsStore = defineStore('jobs', {
  state: () => ({
    currentJobId: 0,
    jobs: [] as Job[],
    columns: [
      { field: 'ID', header: 'ID' },
      { field: 'Status', header: 'Status' },
      { field: 'func', header: 'Function' },
      { field: 'parameters', header: 'Parameters' },
    ],
  }),
  getters: {
    filteredColumns: (state) => state.columns.filter(col => col.field !== 'Star'),
  },
  actions: {
    toggleStar(jobId: number) {
      const jobIndex = this.jobs.findIndex(job => job.ID === jobId);
      if (jobIndex !== -1) {
        this.jobs[jobIndex].Star = !this.jobs[jobIndex].Star;
      }
    },
    setJobs(jobs: Job[]) {
      this.jobs = jobs;
    },
    addJob(newJob: Job): number{
      // Check if there are any jobs. If so, find the highest ID and add 1.
      // If not, start with ID 1.
      const highestId = this.jobs.reduce((max, job) => job.ID > max ? job.ID : max, 0);
      newJob.ID = highestId + 1;
  
      // Now add the new job with the generated ID.
      this.jobs.push(newJob);
      return newJob.ID;
    },
    // New addRequest action
    addRequest(func:string, params: ReqParams): number{
      console.log('Adding new request with func:',func,' parameters:', params);
      const newJob: Job = {
        Star: false, // Initialize Star to false
        ID: 0, // Temporary ID, will be set properly in addJob
        Status: 'Pending', // Initialize Status to "Pending"
        func: func, // Set the function to "atl06p"
        parameters: params // Set the passed ReqParams
      };
      
     return this.addJob(newJob); // Add the new job and return the ID
    },
    updateStatus(jobId: number, newStatus: string) {
      console.log('Updating status of job', jobId, 'to', newStatus);
      const jobIndex = this.jobs.findIndex(job => job.ID === jobId);
      if (jobIndex !== -1) {
        this.jobs[jobIndex].Status = newStatus;
      }
    },
  }
});
