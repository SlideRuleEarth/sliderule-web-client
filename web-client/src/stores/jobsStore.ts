import { defineStore } from 'pinia';
import { type ReqParams } from './reqParamsStore';

interface Job {
  Star: boolean;
  ID: number;
  Status: string;
  Parameters: ReqParams;
}

export const useJobsStore = defineStore('jobs', {
  state: () => ({
    jobs: [] as Job[],
    columns: [
      { field: 'ID', header: 'ID' },
      { field: 'Status', header: 'Status' },
      { field: 'Parameters', header: 'Parameters' },
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
    addJob(newJob: Job) {
      // Check if there are any jobs. If so, find the highest ID and add 1.
      // If not, start with ID 1.
      const highestId = this.jobs.reduce((max, job) => job.ID > max ? job.ID : max, 0);
      newJob.ID = highestId + 1;
  
      // Now add the new job with the generated ID.
      this.jobs.push(newJob);
    },
    // New addRequest action
    addRequest(params: ReqParams) {
      console.log('Adding new request with parameters:', params);
      const newJob: Job = {
        Star: false, // Initialize Star to false
        ID: 0, // Temporary ID, will be set properly in addJob
        Status: 'Pending', // Initialize Status to "Pending"
        Parameters: params // Set the passed ReqParams
      };
      
      this.addJob(newJob); // Use the existing addJob action to add the new job
    }


  }
});
