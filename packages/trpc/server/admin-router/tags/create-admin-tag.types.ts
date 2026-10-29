import { ZAdminTagTypeSchema } from '@documenso/lib/types/admin-tags';
import AdminTagSchema from '@documenso/prisma/generated/zod/modelSchema/AdminTagSchema';
import { z } from 'zod';

export const ZCreateAdminTagRequestSchema = z
  .object({
    userId: z.number().optional(),
    organisationId: z.string().optional(),
    type: ZAdminTagTypeSchema,
    description: z.string().trim().min(1).max(500),
  })
  .refine(
    (data) => {
      const hasUserId = data.userId !== undefined;
      const hasOrganisationId = data.organisationId !== undefined;

      // A tag can't belong to both a user and an organisation.
      if (hasUserId && hasOrganisationId) {
        return false;
      }

      // A tag has to belong to one of them.
      if (!hasUserId && !hasOrganisationId) {
        return false;
      }

      return true;
    },
    {
      message: 'Exactly one of user or organisation is required',
    },
  );

export const ZCreateAdminTagResponseSchema = AdminTagSchema;

export type TCreateAdminTagRequest = z.infer<typeof ZCreateAdminTagRequestSchema>;
export type TCreateAdminTagResponse = z.infer<typeof ZCreateAdminTagResponseSchema>;
