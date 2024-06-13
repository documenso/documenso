import { z } from 'zod';

import { ZBaseTableSearchParamsSchema } from '@documenso/lib/types/search-params';
import { ZRegistrationResponseJSONSchema } from '@documenso/lib/types/webauthn';

export const ZCurrentPasswordSchema = z
  .string()
  .min(6, { message: 'Must be at least 6 characters in length' })
  .max(72);

export const ZPasswordSchema = z
  .string()
  .regex(new RegExp('.*[A-Z].*'), { message: 'One uppercase character' })
  .regex(new RegExp('.*[a-z].*'), { message: 'One lowercase character' })
  .regex(new RegExp('.*\\d.*'), { message: 'One number' })
  .regex(new RegExp('.*[`~<>?,./!@#$%^&*()\\-_+="\'|{}\\[\\];:\\\\].*'), {
    message: 'One special character is required',
  })
  .min(8, { message: 'Must be at least 8 characters in length' })
  .max(72, { message: 'Cannot be more than 72 characters in length' });

export const ZSignUpMutationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: ZPasswordSchema,
  signature: z.string().nullish(),
  url: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .regex(/^[a-z0-9-]+$/, {
      message: 'Username can only container alphanumeric characters and dashes.',
    })
    .optional(),
});

export const ZCreatePasskeyMutationSchema = z.object({
  passkeyName: z.string().trim().min(1),
  verificationResponse: ZRegistrationResponseJSONSchema,
});

export const ZCreatePasskeyAuthenticationOptionsMutationSchema = z
  .object({
    preferredPasskeyId: z.string().optional(),
  })
  .optional();

export const ZDeletePasskeyMutationSchema = z.object({
  passkeyId: z.string().trim().min(1),
});

export const ZUpdatePasskeyMutationSchema = z.object({
  passkeyId: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

export const ZFindPasskeysQuerySchema = ZBaseTableSearchParamsSchema.extend({
  orderBy: z
    .object({
      column: z.enum(['createdAt', 'updatedAt', 'name']),
      direction: z.enum(['asc', 'desc']),
    })
    .optional(),
});

export type TSignUpMutationSchema = z.infer<typeof ZSignUpMutationSchema>;

export const ZVerifyPasswordMutationSchema = ZSignUpMutationSchema.pick({ password: true });
