'use client';

import { useState } from 'react';

import type { User } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';

import { ClaimPublicProfileDialogForm } from '~/components/forms/public-profile-claim-dialog';

export type ClaimProfileAlertDialogProps = {
  className?: string;
  user: User;
};

export const ClaimProfileAlertDialog = ({ className, user }: ClaimProfileAlertDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Alert
        className={cn(
          'flex flex-col items-center justify-between gap-4 p-6 md:flex-row',
          className,
        )}
        variant="neutral"
      >
        <div>
          <AlertTitle>{user.url ? 'Update your profile' : 'Claim your profile'}</AlertTitle>
          <AlertDescription className="mr-2">
            {user.url
              ? 'Profiles are coming soon! Update your profile username to reserve your corner of the signing revolution.'
              : 'Profiles are coming soon! Claim your profile username now to reserve your corner of the signing revolution.'}
          </AlertDescription>
        </div>

        <div className="flex-shrink-0">
          <Button onClick={() => setOpen(true)}>{user.url ? 'Update Now' : 'Claim Now'}</Button>
        </div>
      </Alert>

      <ClaimPublicProfileDialogForm open={open} onOpenChange={setOpen} user={user} />
    </>
  );
};
