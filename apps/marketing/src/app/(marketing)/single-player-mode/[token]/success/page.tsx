import { notFound } from 'next/navigation';

import { getDocumentAndRecipientByToken } from '@documenso/lib/server-only/document/get-document-by-token';

import SinglePlayerModeSuccess from '~/components/(marketing)/single-player-mode/single-player-mode-success';

export type SinglePlayerModeTokenSuccessPageProps = {
  params: {
    token?: string;
  };
};

export default async function SinglePlayerModeTokenSuccessPage({
  params: { token },
}: SinglePlayerModeTokenSuccessPageProps) {
  if (!token) {
    return notFound();
  }

  const document = await getDocumentAndRecipientByToken({
    token,
  }).catch(() => null);

  if (!document || document.status !== 'COMPLETED') {
    return notFound();
  }

  return <SinglePlayerModeSuccess document={document} />;
}
