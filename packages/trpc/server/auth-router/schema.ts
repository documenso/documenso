import { SignatureType } from '@documenso/prisma/client';
import { z } from 'zod';

export const ZSignUpMutationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  signature: z.string().min(1, { message: 'A signature is required.' }),
  signatureType: z.nativeEnum(SignatureType),
});

export type TSignUpMutationSchema = z.infer<typeof ZSignUpMutationSchema>;

export const ZVerifyPasswordMutationSchema = ZSignUpMutationSchema.pick({ password: true });
