import { z } from 'zod';

export const ZCurrentPasswordSchema = z
  .string()
  .min(6, { message: 'Must be at least 6 characters in length' })
  .max(72);

export const ZPasswordSchema = z
  .string()
  .min(8, { message: 'Must be at least 8 characters in length' })
  .max(72, { message: 'Cannot be more than 72 characters in length' })
  .refine((value) => value.length > 25 || /[A-Z]/.test(value), {
    message: 'One uppercase character',
  })
  .refine((value) => value.length > 25 || /[a-z]/.test(value), {
    message: 'One lowercase character',
  })
  .refine((value) => value.length > 25 || /\d/.test(value), {
    message: 'One number',
  })
  .refine((value) => value.length > 25 || /[`~<>?,./!@#$%^&*()\-_"'+=|{}[\];:\\]/.test(value), {
    message: 'One special character is required',
  });
