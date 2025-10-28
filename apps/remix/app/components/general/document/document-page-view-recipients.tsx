import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';
import { TooltipArrow } from '@radix-ui/react-tooltip';
import {
  AlertTriangle,
  CheckIcon,
  Clock,
  MailIcon,
  MailOpenIcon,
  PenIcon,
  PlusIcon,
  UserIcon,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { match } from 'ts-pattern';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { formatSigningLink } from '@documenso/lib/utils/recipients';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { SignatureIcon } from '@documenso/ui/icons/signature';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Badge } from '@documenso/ui/primitives/badge';
import { PopoverHover } from '@documenso/ui/primitives/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentPageViewRecipientsProps = {
  envelope: TEnvelope;
  documentRootPath: string;
};

export const DocumentPageViewRecipients = ({
  envelope,
  documentRootPath,
}: DocumentPageViewRecipientsProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const recipients = envelope.recipients;
  const [shouldHighlightCopyButtons, setShouldHighlightCopyButtons] = useState(false);

  // Check for action=view-tokens query parameter and set highlighting state
  useEffect(() => {
    const hasViewTokensAction = searchParams.get('action') === 'copy-links';

    if (hasViewTokensAction) {
      setShouldHighlightCopyButtons(true);

      // Remove the query parameter immediately
      const params = new URLSearchParams(searchParams);
      params.delete('action');
      setSearchParams(params);
    }
  }, [searchParams, setSearchParams]);

  return (
    <section className="dark:bg-background border-border bg-widget flex flex-col rounded-xl border">
      <div className="flex flex-row items-center justify-between px-4 py-3">
        <h1 className="text-foreground font-medium">
          <Trans>Recipients</Trans>
        </h1>

        {!isDocumentCompleted(envelope.status) && (
          <Link
            to={`${documentRootPath}/${envelope.id}/edit?step=signers`}
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

      <ul className="text-muted-foreground divide-y border-t">
        {recipients.length === 0 && (
          <li className="flex flex-col items-center justify-center py-6 text-sm">
            <Trans>No recipients</Trans>
          </li>
        )}

        {recipients.map((recipient, i) => (
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

            <div className="flex flex-row items-center">
              {envelope.status !== DocumentStatus.DRAFT &&
                recipient.signingStatus === SigningStatus.SIGNED && (
                  <Badge variant="default">
                    {match(recipient.role)
                      .with(RecipientRole.APPROVER, () => (
                        <>
                          <CheckIcon className="mr-1 h-3 w-3" />
                          <Trans>Approved</Trans>
                        </>
                      ))
                      .with(RecipientRole.CC, () =>
                        envelope.status === DocumentStatus.COMPLETED ? (
                          <>
                            <MailIcon className="mr-1 h-3 w-3" />
                            <Trans>Sent</Trans>
                          </>
                        ) : (
                          <>
                            <CheckIcon className="mr-1 h-3 w-3" />
                            <Trans>Ready</Trans>
                          </>
                        ),
                      )

                      .with(RecipientRole.SIGNER, () => (
                        <>
                          <SignatureIcon className="mr-1 h-3 w-3" />
                          <Trans>Signed</Trans>
                        </>
                      ))
                      .with(RecipientRole.VIEWER, () => (
                        <>
                          <MailOpenIcon className="mr-1 h-3 w-3" />
                          <Trans>Viewed</Trans>
                        </>
                      ))
                      .with(RecipientRole.ASSISTANT, () => (
                        <>
                          <UserIcon className="mr-1 h-3 w-3" />
                          <Trans>Assisted</Trans>
                        </>
                      ))
                      .exhaustive()}
                  </Badge>
                )}

              {envelope.status !== DocumentStatus.DRAFT &&
                recipient.signingStatus === SigningStatus.NOT_SIGNED && (
                  <Badge variant="secondary">
                    <Clock className="mr-1 h-3 w-3" />
                    <Trans>Pending</Trans>
                  </Badge>
                )}

              {envelope.status !== DocumentStatus.DRAFT &&
                recipient.signingStatus === SigningStatus.REJECTED && (
                  <PopoverHover
                    trigger={
                      <Badge variant="destructive">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        <Trans>Rejected</Trans>
                      </Badge>
                    }
                  >
                    <p className="text-sm">
                      <Trans>Reason for rejection: </Trans>
                    </p>

                    <p className="text-muted-foreground mt-1 text-sm">
                      {recipient.rejectionReason}
                    </p>
                  </PopoverHover>
                )}

              {envelope.status === DocumentStatus.PENDING &&
                recipient.signingStatus === SigningStatus.NOT_SIGNED &&
                recipient.role !== RecipientRole.CC && (
                  <TooltipProvider>
                    <Tooltip open={shouldHighlightCopyButtons && i === 0}>
                      <TooltipTrigger asChild>
                        <div
                          className={shouldHighlightCopyButtons ? 'animate-pulse' : ''}
                          onClick={() => setShouldHighlightCopyButtons(false)}
                        >
                          <CopyTextButton
                            value={formatSigningLink(recipient.token)}
                            onCopySuccess={() => {
                              toast({
                                title: _(msg`Copied to clipboard`),
                                description: _(
                                  msg`The signing link has been copied to your clipboard.`,
                                ),
                              });
                              setShouldHighlightCopyButtons(false);
                            }}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={2}>
                        <Trans>Copy Signing Links</Trans>
                        <TooltipArrow className="fill-background" />
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
