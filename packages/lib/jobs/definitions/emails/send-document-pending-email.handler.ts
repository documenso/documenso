import { sendPendingEmail } from '../../../server-only/document/send-pending-email';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendDocumentPendingEmailJobDefinition } from './send-document-pending-email';

export const run = async ({ payload }: { payload: TSendDocumentPendingEmailJobDefinition; io: JobRunIO }) => {
  const { envelopeId, recipientId } = payload;

  await sendPendingEmail({
    id: {
      type: 'envelopeId',
      id: envelopeId,
    },
    recipientId,
  });
};
