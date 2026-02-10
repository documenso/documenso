import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { User } from '@prisma/client';
import { DateTime } from 'luxon';

import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';

export type TemplatePageViewInformationProps = {
  userId: number;
  template: {
    userId: number;
    secondaryId: string;
    createdAt: Date;
    updatedAt: Date;
    user: Pick<User, 'id' | 'name' | 'email'>;
  };
};

export const TemplatePageViewInformation = ({
  template,
  userId,
}: TemplatePageViewInformationProps) => {
  const isMounted = useIsMounted();

  const { _, i18n } = useLingui();

  const templateInformation = useMemo(() => {
    return [
      {
        description: msg`Uploaded by`,
        value:
          userId === template.userId ? _(msg`You`) : (template.user.name ?? template.user.email),
      },
      {
        description: msg`Created`,
        value: i18n.date(template.createdAt, { dateStyle: 'medium' }),
      },
      {
        description: msg`Last modified`,
        value: DateTime.fromJSDate(template.updatedAt)
          .setLocale(i18n.locales?.[0] || i18n.locale)
          .toRelative(),
      },
      {
        description: msg`Template ID (Legacy)`,
        value: mapSecondaryIdToTemplateId(template.secondaryId),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, template, userId]);

  return (
    <section className="dark:bg-background text-foreground border-border bg-widget flex flex-col rounded-xl border">
      <h1 className="px-4 py-3 font-medium">
        <Trans>Information</Trans>
      </h1>

      <ul className="divide-y border-t">
        {templateInformation.map((item, i) => (
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
