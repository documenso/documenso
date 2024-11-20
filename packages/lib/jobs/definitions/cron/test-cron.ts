import { prisma } from '@documenso/prisma';

import type { JobDefinition } from '../../client/_internal/job';

const TEST_CRON_JOB_DEFINITION_ID = 'test.cron';

export const TEST_CRON_JOB_DEFINITION = {
  id: TEST_CRON_JOB_DEFINITION_ID,
  name: 'Test Cron Job',
  version: '1.0.0',
  trigger: {
    type: 'cron',
    schedule: '* * * * *',
  },
  handler: async ({ io }) => {
    // send a mail to all recipients of all documents
    const documents = await prisma.document.findMany({});

    console.log(`Found ${documents.length} unsigned documents`);

    for (const document of documents) {
      // eslint-disable-next-line @typescript-eslint/require-await
      await io.runTask(`send-reminder-${document.id}-${document.id}`, async () => {
        console.log(`Sent reminder for document ${document.id} to recipient ${document.id}`);
      });
    }
  },
} as const satisfies JobDefinition<typeof TEST_CRON_JOB_DEFINITION_ID>;
