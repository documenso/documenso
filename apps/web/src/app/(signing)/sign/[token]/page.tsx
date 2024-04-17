<<<<<<< HEAD
import { notFound, redirect } from 'next/navigation';

import { match } from 'ts-pattern';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { viewedDocument } from '@documenso/lib/server-only/document/viewed-document';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import { DocumentStatus, FieldType, SigningStatus } from '@documenso/prisma/client';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';

import { DateField } from './date-field';
import { EmailField } from './email-field';
import { SigningForm } from './form';
import { NameField } from './name-field';
import { SigningProvider } from './provider';
import { SignatureField } from './signature-field';
=======
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
>>>>>>> main

export type SigningPageProps = {
  params: {
    token?: string;
  };
};

export default async function SigningPage({ params: { token } }: SigningPageProps) {
  if (!token) {
    return notFound();
  }

<<<<<<< HEAD
  const [document, fields, recipient] = await Promise.all([
    getDocumentAndSenderByToken({
      token,
    }).catch(() => null),
    getFieldsForToken({ token }),
    getRecipientByToken({ token }).catch(() => null),
    viewedDocument({ token }).catch(() => null),
=======
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
>>>>>>> main
  ]);

  if (!document || !document.documentData || !recipient) {
    return notFound();
  }

<<<<<<< HEAD
  const { documentData } = document;

  const documentDataUrl = await getFile(documentData)
    .then((buffer) => Buffer.from(buffer).toString('base64'))
    .then((data) => `data:application/pdf;base64,${data}`);

  const { user } = await getServerComponentSession();
=======
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
>>>>>>> main

  if (
    document.status === DocumentStatus.COMPLETED ||
    recipient.signingStatus === SigningStatus.SIGNED
  ) {
<<<<<<< HEAD
    redirect(`/sign/${token}/complete`);
  }

  return (
    <SigningProvider email={recipient.email} fullName={recipient.name} signature={user?.signature}>
      <div className="mx-auto w-full max-w-screen-xl">
        <h1 className="mt-4 truncate text-2xl font-semibold md:text-3xl" title={document.title}>
          {document.title}
        </h1>

        <div className="mt-2.5 flex items-center gap-x-6">
          <p className="text-muted-foreground">
            {document.User.name} ({document.User.email}) has invited you to sign this document.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-12 gap-y-8 lg:gap-x-8 lg:gap-y-0">
          <Card
            className="col-span-12 rounded-xl before:rounded-xl lg:col-span-7 xl:col-span-8"
            gradient
          >
            <CardContent className="p-2">
              <LazyPDFViewer document={documentDataUrl} />
            </CardContent>
          </Card>

          <div className="col-span-12 lg:col-span-5 xl:col-span-4">
            <SigningForm document={document} recipient={recipient} fields={fields} />
          </div>
        </div>

        <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
          {fields.map((field) =>
            match(field.type)
              .with(FieldType.SIGNATURE, () => (
                <SignatureField key={field.id} field={field} recipient={recipient} />
              ))
              .with(FieldType.NAME, () => (
                <NameField key={field.id} field={field} recipient={recipient} />
              ))
              .with(FieldType.DATE, () => (
                <DateField key={field.id} field={field} recipient={recipient} />
              ))
              .with(FieldType.EMAIL, () => (
                <EmailField key={field.id} field={field} recipient={recipient} />
              ))
              .otherwise(() => null),
          )}
        </ElementVisible>
      </div>
=======
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
>>>>>>> main
    </SigningProvider>
  );
}
