import { useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';

import { authClient } from '@documenso/auth/client';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { DialogFooter } from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningAuthAccountProps = {
  actionTarget?: 'FIELD' | 'DOCUMENT';
  actionVerb?: string;
  onOpenChange: (value: boolean) => void;
};

export const DocumentSigningAuthAccount = ({
  actionTarget = 'FIELD',
  actionVerb = 'sign',
  onOpenChange,
}: DocumentSigningAuthAccountProps) => {
  const { recipient, isDirectTemplate } = useRequiredDocumentSigningAuthContext();

  const { t } = useLingui();

  const { toast } = useToast();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleChangeAccount = async (email: string) => {
    try {
      setIsSigningOut(true);

      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      await authClient.signOut({
        redirectPath: `/signin?returnTo=${encodeURIComponent(currentPath)}#embedded=true&email=${isDirectTemplate ? '' : email}`,
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
          {actionTarget === 'DOCUMENT' && recipient.role === RecipientRole.VIEWER ? (
            <span>
              {isDirectTemplate ? (
                <Trans>To mark this document as viewed, you need to be logged in.</Trans>
              ) : (
                <Trans>
                  To mark this document as viewed, you need to be logged in as{' '}
                  <strong>{recipient.email}</strong>
                </Trans>
              )}
            </span>
          ) : (
            <span>
              {isDirectTemplate ? (
                <Trans>
                  To {actionVerb.toLowerCase()} this {actionTarget.toLowerCase()}, you need to be
                  logged in.
                </Trans>
              ) : (
                <Trans>
                  To {actionVerb.toLowerCase()} this {actionTarget.toLowerCase()}, you need to be
                  logged in as <strong>{recipient.email}</strong>
                </Trans>
              )}
            </span>
          )}
        </AlertDescription>
      </Alert>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          <Trans>Cancel</Trans>
        </Button>

        <Button onClick={async () => handleChangeAccount(recipient.email)} loading={isSigningOut}>
          <Trans>Login</Trans>
        </Button>
      </DialogFooter>
    </fieldset>
  );
};
