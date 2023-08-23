import { z } from 'zod';

export const ZAddSignersFormSchema = z.object({
  signers: z
    .array(
      z.object({
        formId: z.string().min(1),
        nativeId: z.number().optional(),
        email: z.string().min(1).email(),
        name: z.string(),
      }),
    )
    .refine((signers) => {
      const emails = signers.map((signer) => signer.email);
      return new Set(emails).size === emails.length;
    }, 'Signers must have unique emails'),
});

export type TAddSignersFormSchema = z.infer<typeof ZAddSignersFormSchema>;
