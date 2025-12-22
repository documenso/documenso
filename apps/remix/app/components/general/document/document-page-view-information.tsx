import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DateTime } from 'luxon';

import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';

export type DocumentPageViewInformationProps = {
  userId: number;
  envelope: TEnvelope;
};

export const DocumentPageViewInformation = ({
  envelope,
  userId,
}: DocumentPageViewInformationProps) => {
  const isMounted = useIsMounted();

  const { _, i18n } = useLingui();

  const documentInformation = useMemo(() => {
    return [
      {
        description: msg`Uploaded by`,
        value:
          userId === envelope.userId ? _(msg`You`) : (envelope.user.name ?? envelope.user.email),
      },
      {
        description: msg`Created`,
        value: DateTime.fromJSDate(envelope.createdAt)
          .setLocale(i18n.locales?.[0] || i18n.locale)
          .toFormat('MMMM d, yyyy'),
      },
      {
        description: msg`Last modified`,
        value: DateTime.fromJSDate(envelope.updatedAt)
          .setLocale(i18n.locales?.[0] || i18n.locale)
          .toRelative(),
      },
      {
        description: msg`Document ID (Legacy)`,
        value: mapSecondaryIdToDocumentId(envelope.secondaryId),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, envelope, userId]);

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
