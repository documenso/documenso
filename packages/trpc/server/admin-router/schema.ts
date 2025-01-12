import { Role } from '@prisma/client';
import z from 'zod';

import { ZSiteSettingSchema } from '@documenso/lib/server-only/site-settings/schema';
import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZAdminFindDocumentsQuerySchema = ZFindSearchParamsSchema.extend({
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
});

export type TAdminDeleteUserMutationSchema = z.infer<typeof ZAdminDeleteUserMutationSchema>;

export const ZAdminEnableUserMutationSchema = z.object({
  id: z.number().min(1),
});

export type TAdminEnableUserMutationSchema = z.infer<typeof ZAdminEnableUserMutationSchema>;

export const ZAdminDisableUserMutationSchema = z.object({
  id: z.number().min(1),
});

export type TAdminDisableUserMutationSchema = z.infer<typeof ZAdminDisableUserMutationSchema>;

export const ZAdminDeleteDocumentMutationSchema = z.object({
  id: z.number().min(1),
  reason: z.string(),
});

export type TAdminDeleteDocomentMutationSchema = z.infer<typeof ZAdminDeleteDocumentMutationSchema>;
