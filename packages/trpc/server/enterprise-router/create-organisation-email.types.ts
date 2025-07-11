import { z } from 'zod';

export const ZCreateOrganisationEmailRequestSchema = z.object({
  emailDomainId: z.string(),
  emailName: z.string().min(1).max(100),
  emailPrefix: z
    .string()
    .min(1, 'Email prefix cannot be empty')
    .max(64, 'Email prefix cannot exceed 64 characters')
    .regex(
      /^[a-zA-Z0-9._%+-]+$/,
      'Email prefix can only contain letters, numbers, and the following characters: . _ % + -',
    )
    .refine((val) => !val.includes('@'), 'Email prefix cannot contain @ symbol')
    .refine(
      (val) => !val.includes('\n') && !val.includes('\r'),
      'Email prefix cannot contain newlines',
    ),

  // This does not need to be validated to be part of the domain.
  // replyTo: z.string().email().optional(),
});

export const ZCreateOrganisationEmailResponseSchema = z.void();
