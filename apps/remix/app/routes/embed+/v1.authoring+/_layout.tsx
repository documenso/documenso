import { useLayoutEffect, useState } from 'react';

import { Outlet } from 'react-router';

import { TrpcProvider, trpc } from '@documenso/trpc/react';

import { EmbedClientLoading } from '~/components/embed/embed-client-loading';
import { ZBaseEmbedAuthoringSchema } from '~/types/embed-authoring-base-schema';
import { injectCss } from '~/utils/css-vars';

export default function AuthoringLayout() {
  const [token, setToken] = useState('');

  const {
    mutateAsync: verifyEmbeddingPresignToken,
    isPending: isVerifyingEmbeddingPresignToken,
    data: isVerified,
  } = trpc.embeddingPresign.verifyEmbeddingPresignToken.useMutation();

  useLayoutEffect(() => {
    try {
      const hash = window.location.hash.slice(1);

      const result = ZBaseEmbedAuthoringSchema.safeParse(
        JSON.parse(decodeURIComponent(atob(hash))),
      );

      if (!result.success) {
        return;
      }

      const { token, css, cssVars, darkModeDisabled } = result.data;

      if (darkModeDisabled) {
        document.documentElement.classList.add('dark-mode-disabled');
      }

      injectCss({
        css,
        cssVars,
      });

      void verifyEmbeddingPresignToken({ token }).then((result) => {
        if (result.success) {
          setToken(token);
        }
      });
    } catch (err) {
      console.error('Error verifying embedding presign token:', err);
    }
  }, []);

  if (isVerifyingEmbeddingPresignToken) {
    return <EmbedClientLoading />;
  }

  if (typeof isVerified !== 'undefined' && !isVerified.success) {
    return <div>Invalid embedding presign token</div>;
  }

  return (
    <TrpcProvider headers={{ authorization: `Bearer ${token}` }}>
      <Outlet />
    </TrpcProvider>
  );
}
