import { jobsClient } from '@documenso/lib/jobs/client';
import '@documenso/lib/jobs/definitions';

export const config = {
  maxDuration: 300,
  api: {
    bodyParser: false,
  },
};

export default jobsClient.getApiHandler();
