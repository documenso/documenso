import { z } from 'zod';

export const ZSignUpMutationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  signature: z.string().min(1, { message: 'A signature is required.' }),
});

export type TSignUpMutationSchema = z.infer<typeof ZSignUpMutationSchema>;
