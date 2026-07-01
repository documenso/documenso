import { z } from 'zod';

export const ZFontLibraryTargetSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('personal'),
  }),
  z.object({
    type: z.literal('team'),
    teamId: z.number().min(1),
  }),
  z.object({
    type: z.literal('organisation'),
    organisationId: z.string().min(1),
  }),
]);

export const ZListFontsRequestSchema = z.object({
  target: ZFontLibraryTargetSchema,
});

export const ZUploadFontRequestSchema = z.object({
  target: ZFontLibraryTargetSchema,
  fileName: z.string().min(1),
  displayName: z.string().trim().max(120).optional(),
  mimeType: z.string().min(1).default('font/ttf'),
  fileSize: z.number().min(1),
  bytes: z.string().min(1),
});

export const ZDeleteFontRequestSchema = z.object({
  fontId: z.string().min(1),
});

export type TFontLibraryTarget = z.infer<typeof ZFontLibraryTargetSchema>;
export type TListFontsRequest = z.infer<typeof ZListFontsRequestSchema>;
export type TUploadFontRequest = z.infer<typeof ZUploadFontRequestSchema>;
export type TDeleteFontRequest = z.infer<typeof ZDeleteFontRequestSchema>;
