import { z } from 'zod';

import { ZPasswordSchema } from '../password';

export const ZSignUpMutationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: ZPasswordSchema,
  signature: z.string().min(1, { message: 'A signature is required.' }),
});

export type TSignUpMutationSchema = z.infer<typeof ZSignUpMutationSchema>;
