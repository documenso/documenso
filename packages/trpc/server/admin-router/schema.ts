import { Role } from '@prisma/client';
import z from 'zod';

export const ZUpdateProfileMutationByAdminSchema = z.object({
  id: z.number().min(1),
  name: z.string().nullish(),
  email: z.string().email().optional(),
  roles: z.array(z.nativeEnum(Role)).optional(),
});

export type TUpdateProfileMutationByAdminSchema = z.infer<
  typeof ZUpdateProfileMutationByAdminSchema
>;
