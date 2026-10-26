import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { trpc } from '@documenso/trpc/react';
import { useCallback, useEffect, useRef } from 'react';

export type UsePersistEmbedSignatureOptions = {
  token: string;
  clientUserId: string | null | undefined;
  initialSignature: string | null | undefined;
  debounceMs?: number;
};

export const usePersistEmbedSignature = ({
  token,
  clientUserId,
  initialSignature,
  debounceMs = 500,
}: UsePersistEmbedSignatureOptions) => {
  const { mutate } = trpc.embeddingPresign.persistEmbedSignature.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  });

  const lastPersistedSignature = useRef(initialSignature || null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const persistSignature = useCallback(
    (signature: string | null | undefined) => {
      const nextSignature = signature || null;

      if (!clientUserId || !nextSignature || nextSignature === lastPersistedSignature.current) {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = null;
        }
        return;
      }

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
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
      }, debounceMs);
    },
    [token, clientUserId, mutate, debounceMs],
  );

  return { persistSignature };
};
