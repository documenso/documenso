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
  const pendingSignature = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingSignature = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    const nextSignature = pendingSignature.current;
    if (!clientUserId || !nextSignature || nextSignature === lastPersistedSignature.current) {
      pendingSignature.current = null;
      return;
    }

    pendingSignature.current = null;
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
  }, [token, clientUserId, mutate]);

  useEffect(() => {
    const handleVisibilityOrPageHide = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        flushPendingSignature();
      }
    };

    const handlePageHide = () => {
      flushPendingSignature();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handlePageHide);
      window.addEventListener('visibilitychange', handleVisibilityOrPageHide);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('visibilitychange', handleVisibilityOrPageHide);
      }
      flushPendingSignature();
    };
  }, [flushPendingSignature]);

  const persistSignature = useCallback(
    (signature: string | null | undefined) => {
      const nextSignature = signature || null;

      if (!clientUserId || !nextSignature || nextSignature === lastPersistedSignature.current) {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = null;
        }
        pendingSignature.current = null;
        return;
      }

      pendingSignature.current = nextSignature;

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        flushPendingSignature();
      }, debounceMs);
    },
    [clientUserId, debounceMs, flushPendingSignature],
  );

  return { persistSignature, flush: flushPendingSignature };
};
