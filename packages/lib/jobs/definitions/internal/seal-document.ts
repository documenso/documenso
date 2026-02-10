import { z } from 'zod';

import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import { type JobDefinition } from '../../client/_internal/job';

const SEAL_DOCUMENT_JOB_DEFINITION_ID = 'internal.seal-document';

const SEAL_DOCUMENT_JOB_DEFINITION_SCHEMA = z.object({
  documentId: z.number(),
  sendEmail: z.boolean().optional(),
  isResealing: z.boolean().optional(),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export type TSealDocumentJobDefinition = z.infer<typeof SEAL_DOCUMENT_JOB_DEFINITION_SCHEMA>;

export const SEAL_DOCUMENT_JOB_DEFINITION = {
  id: SEAL_DOCUMENT_JOB_DEFINITION_ID,
  name: 'Seal Document',
  version: '1.0.0',
  optimizeParallelism: true,
  trigger: {
    name: SEAL_DOCUMENT_JOB_DEFINITION_ID,
    schema: SEAL_DOCUMENT_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./seal-document.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEAL_DOCUMENT_JOB_DEFINITION_ID,
  TSealDocumentJobDefinition
>;
