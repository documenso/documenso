import { z } from 'zod';

export const ZSetupMutation = z.object({
  password: z.string().min(1),
});
