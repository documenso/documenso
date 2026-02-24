import { sendCompletedEmail } from '../../../server-only/document/send-completed-email';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendCompletedEmailJobDefinition } from './send-completed-email';

export const run = async ({
  payload,
}: {
  payload: TSendCompletedEmailJobDefinition;
  io: JobRunIO;
}) => {
  const { envelopeId, requestMetadata } = payload;

  await sendCompletedEmail({
    id: {
      type: 'envelopeId',
      id: envelopeId,
    },
    requestMetadata,
  });
};
