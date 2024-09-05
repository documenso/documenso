'use client';

import { useMemo } from 'react';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';

import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { useLocale } from '@documenso/lib/client-only/providers/locale';
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

  const { locale } = useLocale();
  const { _ } = useLingui();

  const documentInformation = useMemo(() => {
    let createdValue = DateTime.fromJSDate(document.createdAt).toFormat('MMMM d, yyyy');
    let lastModifiedValue = DateTime.fromJSDate(document.updatedAt).toRelative();

    if (!isMounted) {
      createdValue = DateTime.fromJSDate(document.createdAt)
        .setLocale(locale)
        .toFormat('MMMM d, yyyy');

      lastModifiedValue = DateTime.fromJSDate(document.updatedAt).setLocale(locale).toRelative();
    }

    return [
      {
        description: msg`Uploaded by`,
        value: userId === document.userId ? _(msg`You`) : document.User.name ?? document.User.email,
      },
      {
        description: msg`Created`,
        value: createdValue,
      },
      {
        description: msg`Last modified`,
        value: lastModifiedValue,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, document, locale, userId]);

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
