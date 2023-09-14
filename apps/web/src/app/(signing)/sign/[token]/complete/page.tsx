import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CheckCircle2, Clock8, Share } from 'lucide-react';
import { match } from 'ts-pattern';

import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { DocumentStatus, FieldType } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';

import { DownloadButton } from './download-button';
import { SigningCard } from './signing-card';

export type CompletedSigningPageProps = {
  params: {
    token?: string;
  };
};

export default async function CompletedSigningPage({
  params: { token },
}: CompletedSigningPageProps) {
  if (!token) {
    return notFound();
  }

  const document = await getDocumentAndSenderByToken({
    token,
  }).catch(() => null);

  if (!document || !document.documentData) {
    return notFound();
  }

  const { documentData } = document;

  const [fields, recipient] = await Promise.all([
    getFieldsForToken({ token }),
    getRecipientByToken({ token }).catch(() => null),
  ]);

  if (!recipient) {
    return notFound();
  }

  const recipientName =
    recipient.name ||
    fields.find((field) => field.type === FieldType.NAME)?.customText ||
    recipient.email;

  return (
    <div className="flex flex-col items-center pt-24">
      {/* Card with recipient */}
      <SigningCard name={recipientName} />

      <div className="mt-6">
        {match(document.status)
          .with(DocumentStatus.COMPLETED, () => (
            <div className="text-documenso-700 flex items-center text-center">
              <CheckCircle2 className="mr-2 h-5 w-5" />
              <span className="text-sm">Everyone has signed</span>
            </div>
          ))
          .otherwise(() => (
            <div className="flex items-center text-center text-blue-600">
              <Clock8 className="mr-2 h-5 w-5" />
              <span className="text-sm">Waiting for others to sign</span>
            </div>
          ))}
      </div>

      <h2 className="mt-6 max-w-[35ch] text-center text-2xl font-semibold leading-normal md:text-3xl lg:text-4xl">
        You have signed "{document.title}"
      </h2>

      {match(document.status)
        .with(DocumentStatus.COMPLETED, () => (
          <p className="text-muted-foreground/60 mt-2.5 max-w-[60ch] text-center text-sm font-medium md:text-base">
            Everyone has signed! You will receive an Email copy of the signed document.
          </p>
        ))
        .otherwise(() => (
          <p className="text-muted-foreground/60 mt-2.5 max-w-[60ch] text-center text-sm font-medium md:text-base">
            You will receive an Email copy of the signed document once everyone has signed.
          </p>
        ))}

      <div className="mt-8 flex w-full max-w-sm items-center justify-center gap-4">
        {/* TODO: Hook this up */}
        <Button variant="outline" className="flex-1">
          <Share className="mr-2 h-5 w-5" />
          Share
        </Button>

        <DownloadButton
          className="flex-1"
          fileName={document.title}
          documentData={documentData}
          disabled={document.status !== DocumentStatus.COMPLETED}
        />
      </div>

      <p className="text-muted-foreground/60 mt-36 text-sm">
        Want so send slick signing links like this one?{' '}
        <Link href="https://documenso.com" className="text-documenso-700 hover:text-documenso-600">
          Check out Documenso.
        </Link>
      </p>
    </div>
  );
}
