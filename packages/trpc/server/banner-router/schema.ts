import z from 'zod';

export const ZCreateBannerByAdminSchema = z.object({
  text: z.string().optional(),
  show: z.boolean().optional(),
});

export type TCreateBannerByAdminSchema = z.infer<typeof ZCreateBannerByAdminSchema>;
