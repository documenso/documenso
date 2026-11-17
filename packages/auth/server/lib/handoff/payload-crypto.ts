import { symmetricDecrypt, symmetricEncrypt } from '@documenso/lib/universal/crypto';
import { z } from 'zod';

export type EncryptAuthHandoffPayloadOptions = {
  secret: string;
  id: string;
  type: string;
  payload: unknown;
};

// `id` and `type` are sealed inside the ciphertext so a payload cannot be
// replayed on another row or under another type.
export const encryptAuthHandoffPayload = ({ secret, id, type, payload }: EncryptAuthHandoffPayloadOptions): string => {
  return symmetricEncrypt({
    key: secret,
    data: JSON.stringify({ id, type, payload }),
  });
};

export type DecryptAuthHandoffPayloadOptions = {
  secret: string;
  id: string;
  type: string;
  encryptedPayload: string;
};

const ZSealedAuthHandoffSchema = z.object({
  id: z.string(),
  type: z.string(),
  payload: z.unknown(),
});

export const decryptAuthHandoffPayload = ({
  secret,
  id,
  type,
  encryptedPayload,
}: DecryptAuthHandoffPayloadOptions): unknown | null => {
  let sealed: unknown;

  try {
    sealed = JSON.parse(
      new TextDecoder().decode(
        symmetricDecrypt({
          key: secret,
          data: encryptedPayload,
        }),
      ),
    );
  } catch {
    return null;
  }

  const parsed = ZSealedAuthHandoffSchema.safeParse(sealed);

  if (!parsed.success) {
    return null;
  }

  if (parsed.data.id !== id || parsed.data.type !== type) {
    return null;
  }

  return parsed.data.payload ?? null;
};
