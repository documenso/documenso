import Link from 'next/link';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { PenIcon, PlusIcon } from 'lucide-react';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { Recipient, Template } from '@documenso/prisma/client';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';

export type TemplatePageViewRecipientsProps = {
  template: Template & {
    Recipient: Recipient[];
  };
  templateRootPath: string;
};

export const TemplatePageViewRecipients = ({
  template,
  templateRootPath,
}: TemplatePageViewRecipientsProps) => {
  const { _ } = useLingui();

  const recipients = template.Recipient;

  return (
    <section className="dark:bg-background border-border bg-widget flex flex-col rounded-xl border">
      <div className="flex flex-row items-center justify-between px-4 py-3">
        <h1 className="text-foreground font-medium">
          <Trans>Recipients</Trans>
        </h1>

        <Link
          href={`${templateRootPath}/${template.id}/edit?step=signers`}
          title={_(msg`Modify recipients`)}
          className="flex flex-row items-center justify-between"
        >
          {recipients.length === 0 ? (
            <PlusIcon className="ml-2 h-4 w-4" />
          ) : (
            <PenIcon className="ml-2 h-3 w-3" />
          )}
        </Link>
      </div>

      <ul className="text-muted-foreground divide-y border-t">
        {recipients.length === 0 && (
          <li className="flex flex-col items-center justify-center py-6 text-sm">
            <Trans>No recipients</Trans>
          </li>
        )}

        {recipients.map((recipient) => (
          <li key={recipient.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <AvatarWithText
              avatarFallback={recipient.email.slice(0, 1).toUpperCase()}
              primaryText={<p className="text-muted-foreground text-sm">{recipient.email}</p>}
              secondaryText={
                <p className="text-muted-foreground/70 text-xs">
                  {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
                </p>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
};
