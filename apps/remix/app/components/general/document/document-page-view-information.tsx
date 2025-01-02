import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Document, Recipient, User } from '@prisma/client';
import { DateTime } from 'luxon';

import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';

export type DocumentPageViewInformationProps = {
  userId: number;
  document: Document & {
    user: Pick<User, 'id' | 'name' | 'email'>;
    recipients: Recipient[];
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
        value:
          userId === document.userId ? _(msg`You`) : (document.user.name ?? document.user.email),
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
