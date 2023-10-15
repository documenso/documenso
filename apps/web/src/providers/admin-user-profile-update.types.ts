import { z } from 'zod';

import { ZUpdateProfileMutationByAdminSchema } from '@documenso/trpc/server/admin-router/schema';

export const ZUserFormSchema = ZUpdateProfileMutationByAdminSchema.omit({ id: true });
export type TUserFormSchema = z.infer<typeof ZUserFormSchema>;
