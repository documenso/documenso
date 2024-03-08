import { Role } from '@prisma/client';
import z from 'zod';

import { ZSiteSettingSchema } from '@documenso/lib/server-only/site-settings/schema';

export const ZAdminFindDocumentsQuerySchema = z.object({
  term: z.string().optional(),
  page: z.number().optional().default(1),
  perPage: z.number().optional().default(20),
});

export type TAdminFindDocumentsQuerySchema = z.infer<typeof ZAdminFindDocumentsQuerySchema>;

export const ZAdminUpdateProfileMutationSchema = z.object({
  id: z.number().min(1),
  name: z.string().nullish(),
  email: z.string().email().optional(),
  roles: z.array(z.nativeEnum(Role)).optional(),
});

export type TAdminUpdateProfileMutationSchema = z.infer<typeof ZAdminUpdateProfileMutationSchema>;

export const ZAdminUpdateRecipientMutationSchema = z.object({
  id: z.number().min(1),
  name: z.string().optional(),
  email: z.string().email().optional(),
});

export type TAdminUpdateRecipientMutationSchema = z.infer<
  typeof ZAdminUpdateRecipientMutationSchema
>;

export const ZAdminUpdateSiteSettingMutationSchema = ZSiteSettingSchema;

export type TAdminUpdateSiteSettingMutationSchema = z.infer<
  typeof ZAdminUpdateSiteSettingMutationSchema
>;

export const ZAdminResealDocumentMutationSchema = z.object({
  id: z.number().min(1),
});

export type TAdminResealDocumentMutationSchema = z.infer<typeof ZAdminResealDocumentMutationSchema>;

export const ZAdminDeleteUserMutationSchema = z.object({
  id: z.number().min(1),
  email: z.string().email(),
});

export type TAdminDeleteUserMutationSchema = z.infer<typeof ZAdminDeleteUserMutationSchema>;
