import { z } from 'zod';

export const ZSetupMutation = z.object({
  password: z.string().min(1),
});

export const ZEnableMutation = z.object({
  code: z.string().min(6).max(6),
});

export const ZDisableMutation = z
  .object({
    code: z.string().optional(),
    backupCode: z.string().trim().optional(),
  })
  .merge(ZSetupMutation);
