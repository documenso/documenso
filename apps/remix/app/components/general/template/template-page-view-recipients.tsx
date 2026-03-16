import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Recipient } from '@prisma/client';
import { PenIcon, PlusIcon } from 'lucide-react';
import { Link } from 'react-router';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { isTemplateRecipientEmailPlaceholder } from '@documenso/lib/constants/template';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';

export type TemplatePageViewRecipientsProps = {
  recipients: Recipient[];
  envelopeId: string;
  templateRootPath: string;
  readOnly?: boolean;
};

export const TemplatePageViewRecipients = ({
  recipients,
  envelopeId,
  templateRootPath,
  readOnly = false,
}: TemplatePageViewRecipientsProps) => {
  const { _ } = useLingui();

  return (
    <section className="flex flex-col rounded-xl border border-border bg-widget dark:bg-background">
      <div className="flex flex-row items-center justify-between px-4 py-3">
        <h1 className="font-medium text-foreground">
          <Trans>Recipients</Trans>
        </h1>

        {!readOnly && (
          <Link
            to={`${templateRootPath}/${envelopeId}/edit?step=signers`}
            title={_(msg`Modify recipients`)}
            className="flex flex-row items-center justify-between"
          >
            {recipients.length === 0 ? (
              <PlusIcon className="ml-2 h-4 w-4" />
            ) : (
              <PenIcon className="ml-2 h-3 w-3" />
            )}
          </Link>
        )}
      </div>

      <ul className="divide-y border-t text-muted-foreground">
        {recipients.length === 0 && (
          <li className="flex flex-col items-center justify-center py-6 text-sm">
            <Trans>No recipients</Trans>
          </li>
        )}

        {recipients.map((recipient) => (
          <li key={recipient.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <AvatarWithText
              avatarFallback={
                isTemplateRecipientEmailPlaceholder(recipient.email)
                  ? extractInitials(recipient.name)
                  : recipient.email.slice(0, 1).toUpperCase()
              }
              primaryText={
                isTemplateRecipientEmailPlaceholder(recipient.email) ? (
                  <p className="text-sm text-muted-foreground">{recipient.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{recipient.email}</p>
                )
              }
              secondaryText={
                <p className="text-xs text-muted-foreground/70">
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
