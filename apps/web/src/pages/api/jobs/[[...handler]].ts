import { jobsClient } from '@documenso/lib/jobs/client';

export const config = {
  maxDuration: 300,
  api: {
    bodyParser: false,
  },
};

export default jobsClient.getApiHandler();
