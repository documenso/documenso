import { JobClient } from './client/client';
import { registerJobs } from './definitions';

export const jobsClient = JobClient.getInstance();

registerJobs(jobsClient);
