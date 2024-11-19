import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Trans } from '@lingui/macro';
import { XCircle } from 'lucide-react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { isRecipientAuthorized } from '@documenso/lib/server-only/document/is-recipient-authorized';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { FieldType } from '@documenso/prisma/client';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';

import { truncateTitle } from '~/helpers/truncate-title';

import { SigningAuthPageView } from '../signing-auth-page';

export type RejectedSigningPageProps = {
  params: {
    token?: string;
  };
};

export default async function RejectedSigningPage({ params: { token } }: RejectedSigningPageProps) {
  await setupI18nSSR();

  if (!token) {
    return notFound();
  }

  const { user } = await getServerComponentSession();

  const document = await getDocumentAndSenderByToken({
    token,
    requireAccessAuth: false,
  }).catch(() => null);

  if (!document) {
    return notFound();
  }

  const truncatedTitle = truncateTitle(document.title);

  const [fields, recipient] = await Promise.all([
    getFieldsForToken({ token }),
    getRecipientByToken({ token }).catch(() => null),
  ]);

  if (!recipient) {
    return notFound();
  }

  const isDocumentAccessValid = await isRecipientAuthorized({
    type: 'ACCESS',
    documentAuthOptions: document.authOptions,
    recipient,
    userId: user?.id,
  });

  if (!isDocumentAccessValid) {
    return <SigningAuthPageView email={recipient.email} />;
  }

  const recipientName =
    recipient.name ||
    fields.find((field) => field.type === FieldType.NAME)?.customText ||
    recipient.email;

  return (
    <div className="flex flex-col items-center pt-24 lg:pt-36 xl:pt-44">
      <Badge variant="neutral" size="default" className="mb-6 rounded-xl border bg-transparent">
        {truncatedTitle}
      </Badge>

      <div className="flex flex-col items-center">
        <div className="flex items-center gap-x-4">
          <XCircle className="text-destructive h-10 w-10" />

          <h2 className="max-w-[35ch] text-center text-2xl font-semibold leading-normal md:text-3xl lg:text-4xl">
            <Trans>Document Rejected</Trans>
          </h2>
        </div>

        <div className="text-destructive mt-4 flex items-center text-center text-sm">
          <Trans>You have rejected this document</Trans>
        </div>

        <p className="text-muted-foreground mt-6 max-w-[60ch] text-center text-sm">
          <Trans>
            The document owner has been notified of your decision. They may contact you with further
            instructions if necessary.
          </Trans>
        </p>

        <p className="text-muted-foreground mt-2 max-w-[60ch] text-center text-sm">
          <Trans>No further action is required from you at this time.</Trans>
        </p>

        {user && (
          <Button className="mt-6" asChild>
            <Link href={`/`}>Return Home</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
