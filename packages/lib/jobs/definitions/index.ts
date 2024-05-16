import type { JobClient } from '../client/client';
import { registerSendConfirmationEmailJob } from './send-confirmation-email';

export const registerJobs = (client: JobClient) => {
  registerSendConfirmationEmailJob(client);
};
