import { z } from 'zod';

import { ZBaseTableSearchParamsSchema } from '@documenso/lib/types/search-params';
import { ZRegistrationResponseJSONSchema } from '@documenso/lib/types/webauthn';

export const ZCurrentPasswordSchema = z
  .string()
  .min(6, { message: 'მინიმუმ 6 სიმბოლოს უნდა შეიცავდეს' })
  .max(72);

export const ZPasswordSchema = z
  .string()
  .regex(new RegExp('.*[A-Z].*'), { message: 'მინ. ერთი დიდი სიმბოლო' })
  .regex(new RegExp('.*[a-z].*'), { message: 'მინ. ერთი პატარა სიმბოლო' })
  .regex(new RegExp('.*\\d.*'), { message: 'მინ. ერთი რიცხვი' })
  .regex(new RegExp('.*[`~<>?,./!@#$%^&*()\\-_+="\'|{}\\[\\];:\\\\].*'), {
    message: 'მინ. ერთი სპეციალური სიმბოლო',
  })
  .min(8, { message: 'მინიმუმ 8 სიმბოლოს უნდა შეიცავდეს' })
  .max(72, { message: 'არ შეიძლება იყოს 72 სიმბოლოზე მეტი სიგრძის' });

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
      message: 'სახელი შეიძლება შეიცავდეს მხოლოდ ასო-ციფრულ სიმბოლოებსა და ტირეებს.',
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
