import { z } from 'zod';

export const ZNumberAdvancedSettingsFormSchema = z.object({
  label: z.string(),
  placeholder: z.string(),
  format: z.string(),
  characterLimit: z.string(),
});

export type TNumberAdvancedSettingsFormSchema = z.infer<typeof ZNumberAdvancedSettingsFormSchema>;
