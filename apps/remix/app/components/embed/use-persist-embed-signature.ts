import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { trpc } from '@documenso/trpc/react';
import { useCallback, useRef } from 'react';

export type UsePersistEmbedSignatureOptions = {
  token: string;
  clientUserId: string | null | undefined;
  initialSignature: string | null | undefined;
};

export const usePersistEmbedSignature = ({
  token,
  clientUserId,
  initialSignature,
}: UsePersistEmbedSignatureOptions) => {
  const { mutate } = trpc.embeddingPresign.persistEmbedSignature.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  });

  const lastPersistedSignature = useRef(initialSignature || null);

  const persistSignature = useCallback(
    (signature: string | null | undefined) => {
      const nextSignature = signature || null;

      if (!clientUserId || !nextSignature || nextSignature === lastPersistedSignature.current) {
        return;
      }

      mutate(
        {
          token,
          clientUserId,
          signature: nextSignature,
        },
        {
          onSuccess: () => {
            lastPersistedSignature.current = nextSignature;
          },
          onError: () => null,
        },
      );
    },
    [token, clientUserId, mutate],
  );

  return { persistSignature };
};
