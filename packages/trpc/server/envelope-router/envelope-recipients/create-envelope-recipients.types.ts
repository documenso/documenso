import { RecipientRole } from '@prisma/client';
import { z } from 'zod';

import {
  ZRecipientAccessAuthTypesSchema,
  ZRecipientActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import {
  ZEnvelopeRecipientLiteSchema,
  ZRecipientEmailSchema,
} from '@documenso/lib/types/recipient';

import type { TrpcRouteMeta } from '../../trpc';

export const createEnvelopeRecipientsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/recipient/create-many',
    summary: 'Create envelope recipients',
    description: 'Create multiple recipients for an envelope',
    tags: ['Envelope Recipients'],
  },
};

export const ZCreateEnvelopeRecipientSchema = z.object({
  email: ZRecipientEmailSchema,
  name: z.string().max(255),
  role: z.nativeEnum(RecipientRole),
  signingOrder: z.number().optional(),
  accessAuth: z.array(ZRecipientAccessAuthTypesSchema).default([]).optional(),
  actionAuth: z.array(ZRecipientActionAuthTypesSchema).default([]).optional(),
});

export const ZCreateEnvelopeRecipientsRequestSchema = z.object({
  envelopeId: z.string(),
  data: ZCreateEnvelopeRecipientSchema.array(),
});

export const ZCreateEnvelopeRecipientsResponseSchema = z.object({
  data: ZEnvelopeRecipientLiteSchema.array(),
});

export type TCreateEnvelopeRecipientsRequest = z.infer<
  typeof ZCreateEnvelopeRecipientsRequestSchema
>;
export type TCreateEnvelopeRecipientsResponse = z.infer<
  typeof ZCreateEnvelopeRecipientsResponseSchema
>;
