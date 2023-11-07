import { z } from 'zod';

export const ZSetupMutation = z.object({
  password: z.string().min(1),
});

export const ZEnableMutation = z.object({
  code: z.string().min(1),
});

export const ZDisableMutation = ZEnableMutation.merge(ZSetupMutation);
