import { isBase64Image, isPngSignatureDataUrl } from '@documenso/lib/constants/signatures';
import { ZEmbedClientUserIdSchema } from '@documenso/lib/types/embed-signature';
import { z } from 'zod';

const IMAGE_SIGNATURE_MAX_LENGTH = 1024 * 1024;
const TYPED_SIGNATURE_MAX_LENGTH = 256;

// Unicode "Other" category: control characters, format characters, unassigned
// code points and surrogates. None can be produced by the signature pad input.
const CONTROL_CHARACTER_REGEX = /\p{C}/u;

const ZEmbedSignatureValueSchema = z
  .string()
  .min(1)
  .max(IMAGE_SIGNATURE_MAX_LENGTH)
  .refine(
    (value) => {
      if (isBase64Image(value)) {
        return isPngSignatureDataUrl(value);
      }

      return value.length <= TYPED_SIGNATURE_MAX_LENGTH && !CONTROL_CHARACTER_REGEX.test(value);
    },
    {
      message: 'Signature must be a PNG data URL or a short typed signature',
    },
  );

export const ZPersistEmbedSignatureRequestSchema = z.object({
  token: z.string().min(1),
  clientUserId: ZEmbedClientUserIdSchema,
  signature: ZEmbedSignatureValueSchema,
});

export const ZPersistEmbedSignatureResponseSchema = z.object({
  success: z.literal(true),
});

export type TPersistEmbedSignatureRequestSchema = z.infer<typeof ZPersistEmbedSignatureRequestSchema>;
export type TPersistEmbedSignatureResponseSchema = z.infer<typeof ZPersistEmbedSignatureResponseSchema>;
