import { Role } from '@prisma/client';
import z from 'zod';

export const ZUpdateProfileMutationByAdminSchema = z.object({
  id: z.number().min(1),
  name: z.string(),
  email: z.string().email(),
  roles: z.array(z.nativeEnum(Role)),
});

export type TUpdateProfileMutationByAdminSchema = z.infer<
  typeof ZUpdateProfileMutationByAdminSchema
>;
