import { msg } from '@lingui/core/macro';
import { z } from 'zod';

export const ZCurrentPasswordSchema = z
  .string()
  .min(6, { message: msg`Must be at least 6 characters in length`.id })
  .max(72);

export const ZPasswordSchema = z
  .string()
  .min(8, { message: msg`Must be at least 8 characters in length`.id })
  .max(72, { message: msg`Cannot be more than 72 characters in length`.id })
  .refine((value) => value.length > 25 || /[A-Z]/.test(value), {
    message: msg`One uppercase character`.id,
  })
  .refine((value) => value.length > 25 || /[a-z]/.test(value), {
    message: msg`One lowercase character`.id,
  })
  .refine((value) => value.length > 25 || /\d/.test(value), {
    message: msg`One number`.id,
  })
  .refine((value) => value.length > 25 || /[`~<>?,./!@#$%^&*()\-_"'+=|{}[\];:\\]/.test(value), {
    message: msg`One special character is required`.id,
  });
