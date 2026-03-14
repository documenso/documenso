import { RecipientRole } from '@prisma/client';
import { z } from 'zod';

import {
  ZRecipientAccessAuthTypesSchema,
  ZRecipientActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZRecipientEmailSchema, ZRecipientLiteSchema } from '@documenso/lib/types/recipient';

import type { TrpcRouteMeta } from '../../trpc';

export const updateEnvelopeRecipientsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/recipient/update-many',
    summary: 'Update envelope recipients',
    description: 'Update multiple recipients for an envelope',
    tags: ['Envelope Recipients'],
  },
};

export const ZUpdateEnvelopeRecipientSchema = z.object({
  id: z.number().describe('The ID of the recipient to update.'),
  email: ZRecipientEmailSchema.optional(),
  name: z.string().max(255).optional(),
  role: z.nativeEnum(RecipientRole).optional(),
  signingOrder: z.number().optional(),
  accessAuth: z.array(ZRecipientAccessAuthTypesSchema).default([]).optional(),
  actionAuth: z.array(ZRecipientActionAuthTypesSchema).default([]).optional(),
});

export const ZUpdateEnvelopeRecipientsRequestSchema = z.object({
  envelopeId: z.string(),
  data: ZUpdateEnvelopeRecipientSchema.array(),
});

export const ZUpdateEnvelopeRecipientsResponseSchema = z.object({
  data: ZRecipientLiteSchema.array(),
});

export type TUpdateEnvelopeRecipientsRequest = z.infer<
  typeof ZUpdateEnvelopeRecipientsRequestSchema
>;
export type TUpdateEnvelopeRecipientsResponse = z.infer<
  typeof ZUpdateEnvelopeRecipientsResponseSchema
>;
