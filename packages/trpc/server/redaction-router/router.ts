import { createEnvelopeRedactions } from '@documenso/lib/server-only/redaction/create-envelope-redactions';
import { deleteEnvelopeRedaction } from '@documenso/lib/server-only/redaction/delete-envelope-redaction';
import { updateEnvelopeRedactions } from '@documenso/lib/server-only/redaction/update-envelope-redactions';

import { ZGenericSuccessResponse, ZSuccessResponseSchema } from '../schema';
import { authenticatedProcedure, router } from '../trpc';
import {
  ZCreateDocumentRedactionsRequestSchema,
  ZCreateDocumentRedactionsResponseSchema,
  ZDeleteDocumentRedactionRequestSchema,
  ZUpdateDocumentRedactionsRequestSchema,
  ZUpdateDocumentRedactionsResponseSchema,
} from './schema';

const mapToResponse = (r: {
  id: number;
  secondaryId: string;
  envelopeItemId: string;
  page: number;
  positionX: unknown;
  positionY: unknown;
  width: unknown;
  height: unknown;
}) => ({
  id: r.id,
  secondaryId: r.secondaryId,
  envelopeItemId: r.envelopeItemId,
  page: r.page,
  positionX: Number(r.positionX),
  positionY: Number(r.positionY),
  width: Number(r.width),
  height: Number(r.height),
});

export const redactionRouter = router({
  createDocumentRedactions: authenticatedProcedure
    .input(ZCreateDocumentRedactionsRequestSchema)
    .output(ZCreateDocumentRedactionsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const created = await createEnvelopeRedactions({
        userId: ctx.user.id,
        teamId: ctx.teamId,
        id: { type: 'documentId', id: input.documentId },
        redactions: input.redactions,
      });
      return { redactions: created.map(mapToResponse) };
    }),

  updateDocumentRedactions: authenticatedProcedure
    .input(ZUpdateDocumentRedactionsRequestSchema)
    .output(ZUpdateDocumentRedactionsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const updated = await updateEnvelopeRedactions({
        userId: ctx.user.id,
        teamId: ctx.teamId,
        id: { type: 'documentId', id: input.documentId },
        redactions: input.redactions,
      });
      return { redactions: updated.map(mapToResponse) };
    }),

  deleteDocumentRedaction: authenticatedProcedure
    .input(ZDeleteDocumentRedactionRequestSchema)
    .output(ZSuccessResponseSchema)
    .mutation(async ({ input, ctx }) => {
      await deleteEnvelopeRedaction({
        userId: ctx.user.id,
        teamId: ctx.teamId,
        id: { type: 'documentId', id: input.documentId },
        redactionId: input.redactionId,
      });
      return ZGenericSuccessResponse;
    }),
});
