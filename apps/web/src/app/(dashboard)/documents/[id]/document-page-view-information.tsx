'use client';

import { useMemo } from 'react';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';

import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import type { Document, Recipient, User } from '@documenso/prisma/client';

export type DocumentPageViewInformationProps = {
  userId: number;
  document: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
  };
};

export const DocumentPageViewInformation = ({
  document,
  userId,
}: DocumentPageViewInformationProps) => {
  const isMounted = useIsMounted();

  const { _, i18n } = useLingui();

  const documentInformation = useMemo(() => {
    return [
      {
        description: msg`Uploaded by`,
        value: userId === document.userId ? _(msg`You`) : document.User.name ?? document.User.email,
      },
      {
        description: msg`Created`,
        value: DateTime.fromJSDate(document.createdAt)
          .setLocale(i18n.locales?.[0] || i18n.locale)
          .toFormat('MMMM d, yyyy'),
      },
      {
        description: msg`Last modified`,
        value: DateTime.fromJSDate(document.updatedAt)
          .setLocale(i18n.locales?.[0] || i18n.locale)
          .toRelative(),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, document, userId]);

  return (
    <section className="dark:bg-background text-foreground border-border bg-widget flex flex-col rounded-xl border">
      <h1 className="px-4 py-3 font-medium">
        <Trans>Information</Trans>
      </h1>

      <ul className="divide-y border-t">
        {documentInformation.map((item, i) => (
          <li
            key={i}
            className="flex items-center justify-between px-4 py-2.5 text-sm last:border-b"
          >
            <span className="text-muted-foreground">{_(item.description)}</span>
            <span>{item.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
