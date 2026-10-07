import { authClient } from '@documenso/auth/client';
import { useIsFramed } from '@documenso/lib/client-only/hooks/use-is-framed';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { formatPath } from '@documenso/lib/constants/app';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { DialogFooter } from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import { useState } from 'react';
import { useRevalidator } from 'react-router';
import { match } from 'ts-pattern';

import { EmbedPopupAuth } from '~/components/embed/embed-popup-auth';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningAuthAccountProps = {
  actionTarget?: 'FIELD' | 'DOCUMENT';
  onOpenChange: (value: boolean) => void;
};

export const DocumentSigningAuthAccount = ({
  actionTarget = 'FIELD',
  onOpenChange,
}: DocumentSigningAuthAccountProps) => {
  const { recipient, user, isDirectTemplate } = useRequiredDocumentSigningAuthContext();

  const { t } = useLingui();

  const { toast } = useToast();

  const isFramed = useIsFramed();

  const { refreshSession } = useOptionalSession();
  const { revalidate } = useRevalidator();

  const [isSigningOut, setIsSigningOut] = useState(false);

  // Direct templates accept any account, so a mismatch only matters for regular recipients.
  const mismatchedUserEmail = user && !isDirectTemplate && user.email !== recipient.email ? user.email : undefined;

  const onPopupAuthSuccess = async () => {
    await Promise.all([refreshSession(), revalidate()]);

    onOpenChange(false);
  };

  const handleChangeAccount = async (email: string) => {
    try {
      setIsSigningOut(true);

      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      const emailHash = isDirectTemplate ? '' : `#email=${encodeURIComponent(email)}`;

      await authClient.signOut({
        redirectPath: formatPath(`/signin?returnTo=${encodeURIComponent(currentPath)}${emailHash}`),
      });
    } catch {
      setIsSigningOut(false);

      toast({
        title: t`Something went wrong`,
        description: t`We were unable to log you out at this time.`,
        duration: 10000,
        variant: 'destructive',
      });
    }
  };

  return (
    <fieldset disabled={isSigningOut} className="space-y-4">
      <Alert variant="warning">
        <AlertDescription>
          <span>
            {match({ role: recipient.role, actionTarget })
              .with({ role: RecipientRole.SIGNER, actionTarget: 'FIELD' }, () =>
                isDirectTemplate ? (
                  <Trans>To sign this field, you need to be logged in.</Trans>
                ) : (
                  <Trans>
                    To sign this field, you need to be logged in as <strong>{recipient.email}</strong>
                  </Trans>
                ),
              )
              .with({ role: RecipientRole.SIGNER, actionTarget: 'DOCUMENT' }, () =>
                isDirectTemplate ? (
                  <Trans>To sign this document, you need to be logged in.</Trans>
                ) : (
                  <Trans>
                    To sign this document, you need to be logged in as <strong>{recipient.email}</strong>
                  </Trans>
                ),
              )
              .with({ role: RecipientRole.APPROVER, actionTarget: 'FIELD' }, () =>
                isDirectTemplate ? (
                  <Trans>To approve this field, you need to be logged in.</Trans>
                ) : (
                  <Trans>
                    To approve this field, you need to be logged in as <strong>{recipient.email}</strong>
                  </Trans>
                ),
              )
              .with({ role: RecipientRole.APPROVER, actionTarget: 'DOCUMENT' }, () =>
                isDirectTemplate ? (
                  <Trans>To approve this document, you need to be logged in.</Trans>
                ) : (
                  <Trans>
                    To approve this document, you need to be logged in as <strong>{recipient.email}</strong>
                  </Trans>
                ),
              )
              .with({ role: RecipientRole.VIEWER, actionTarget: 'FIELD' }, () =>
                isDirectTemplate ? (
                  <Trans>To view this field, you need to be logged in.</Trans>
                ) : (
                  <Trans>
                    To view this field, you need to be logged in as <strong>{recipient.email}</strong>
                  </Trans>
                ),
              )
              .with({ role: RecipientRole.VIEWER, actionTarget: 'DOCUMENT' }, () =>
                isDirectTemplate ? (
                  <Trans>To mark this document as viewed, you need to be logged in.</Trans>
                ) : (
                  <Trans>
                    To mark this document as viewed, you need to be logged in as <strong>{recipient.email}</strong>
                  </Trans>
                ),
              )
              .with({ role: RecipientRole.CC, actionTarget: 'FIELD' }, () =>
                isDirectTemplate ? (
                  <Trans>To view this field, you need to be logged in.</Trans>
                ) : (
                  <Trans>
                    To view this field, you need to be logged in as <strong>{recipient.email}</strong>
                  </Trans>
                ),
              )
              .with({ role: RecipientRole.CC, actionTarget: 'DOCUMENT' }, () =>
                isDirectTemplate ? (
                  <Trans>To view this document, you need to be logged in.</Trans>
                ) : (
                  <Trans>
                    To view this document, you need to be logged in as <strong>{recipient.email}</strong>
                  </Trans>
                ),
              )
              .with({ role: RecipientRole.ASSISTANT, actionTarget: 'FIELD' }, () =>
                isDirectTemplate ? (
                  <Trans>To assist with this field, you need to be logged in.</Trans>
                ) : (
                  <Trans>
                    To assist with this field, you need to be logged in as <strong>{recipient.email}</strong>
                  </Trans>
                ),
              )
              .with({ role: RecipientRole.ASSISTANT, actionTarget: 'DOCUMENT' }, () =>
                isDirectTemplate ? (
                  <Trans>To assist with this document, you need to be logged in.</Trans>
                ) : (
                  <Trans>
                    To assist with this document, you need to be logged in as <strong>{recipient.email}</strong>
                  </Trans>
                ),
              )
              .exhaustive()}
          </span>
        </AlertDescription>
      </Alert>

      {isFramed ? (
        <>
          <EmbedPopupAuth
            email={isDirectTemplate ? undefined : recipient.email}
            signedInAs={mismatchedUserEmail}
            onSuccess={() => void onPopupAuthSuccess()}
          />

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              <Trans>Cancel</Trans>
            </Button>
          </DialogFooter>
        </>
      ) : (
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <Button onClick={async () => handleChangeAccount(recipient.email)} loading={isSigningOut}>
            <Trans>Login</Trans>
          </Button>
        </DialogFooter>
      )}
    </fieldset>
  );
};
