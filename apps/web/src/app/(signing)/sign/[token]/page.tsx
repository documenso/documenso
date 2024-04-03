import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { isRecipientAuthorized } from '@documenso/lib/server-only/document/is-recipient-authorized';
import { viewedDocument } from '@documenso/lib/server-only/document/viewed-document';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getRecipientSignatures } from '@documenso/lib/server-only/recipient/get-recipient-signatures';
import { symmetricDecrypt } from '@documenso/lib/universal/crypto';
import { extractNextHeaderRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { DocumentStatus, SigningStatus } from '@documenso/prisma/client';

import { DocumentAuthProvider } from './document-auth-provider';
import { NoLongerAvailable } from './no-longer-available';
import { SigningProvider } from './provider';
import { SigningAuthPageView } from './signing-auth-page';
import { SigningPageView } from './signing-page-view';

export type SigningPageProps = {
  params: {
    token?: string;
  };
};

export default async function SigningPage({ params: { token } }: SigningPageProps) {
  if (!token) {
    return notFound();
  }

  const { user } = await getServerComponentSession();

  const requestHeaders = Object.fromEntries(headers().entries());

  const requestMetadata = extractNextHeaderRequestMetadata(requestHeaders);

  const [document, fields, recipient] = await Promise.all([
    getDocumentAndSenderByToken({
      token,
      userId: user?.id,
      requireAccessAuth: false,
    }).catch(() => null),
    getFieldsForToken({ token }),
    getRecipientByToken({ token }).catch(() => null),
  ]);

  if (!document || !document.documentData || !recipient) {
    return notFound();
  }

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipient.authOptions,
  });

  const isDocumentAccessValid = await isRecipientAuthorized({
    type: 'ACCESS',
    document,
    recipient,
    userId: user?.id,
  });

  if (!isDocumentAccessValid) {
    return <SigningAuthPageView email={recipient.email} />;
  }

  await viewedDocument({
    token,
    requestMetadata,
    recipientAccessAuth: derivedRecipientAccessAuth,
  }).catch(() => null);

  const { documentMeta } = document;

  if (
    document.status === DocumentStatus.COMPLETED ||
    recipient.signingStatus === SigningStatus.SIGNED
  ) {
    documentMeta?.redirectUrl
      ? redirect(documentMeta.redirectUrl)
      : redirect(`/sign/${token}/complete`);
  }

  if (documentMeta?.password) {
    const key = DOCUMENSO_ENCRYPTION_KEY;

    if (!key) {
      throw new Error('Missing DOCUMENSO_ENCRYPTION_KEY');
    }

    const securePassword = Buffer.from(
      symmetricDecrypt({
        key,
        data: documentMeta.password,
      }),
    ).toString('utf-8');

    documentMeta.password = securePassword;
  }

  const [recipientSignature] = await getRecipientSignatures({ recipientId: recipient.id });

  if (document.deletedAt) {
    return (
      <NoLongerAvailable
        document={document}
        recipientName={recipient.name}
        recipientSignature={recipientSignature}
      />
    );
  }

  return (
    <SigningProvider
      email={recipient.email}
      fullName={user?.email === recipient.email ? user.name : recipient.name}
      signature={user?.email === recipient.email ? user.signature : undefined}
    >
      <DocumentAuthProvider document={document} recipient={recipient} user={user}>
        <SigningPageView recipient={recipient} document={document} fields={fields} />
      </DocumentAuthProvider>
    </SigningProvider>
  );
}
