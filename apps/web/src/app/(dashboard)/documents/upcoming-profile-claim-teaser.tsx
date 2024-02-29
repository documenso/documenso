'use client';

import { useCallback, useEffect, useState } from 'react';

import type { User } from '@documenso/prisma/client';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { ClaimPublicProfileDialogForm } from '~/components/forms/public-profile-claim-dialog';

export type UpcomingProfileClaimTeaserProps = {
  user: User;
};

export const UpcomingProfileClaimTeaser = ({ user }: UpcomingProfileClaimTeaserProps) => {
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !claimed) {
        toast({
          title: 'Claim your profile later',
          description: 'You can claim your profile later on by going to your profile settings!',
        });
      }

      setOpen(open);
      localStorage.setItem('app.hasShownProfileClaimDialog', 'true');
    },
    [claimed, toast],
  );

  useEffect(() => {
    const hasShownProfileClaimDialog =
      localStorage.getItem('app.hasShownProfileClaimDialog') === 'true';

    if (!user.url && !hasShownProfileClaimDialog) {
      onOpenChange(true);
    }
  }, [onOpenChange, user.url]);

  return (
    <ClaimPublicProfileDialogForm
      open={open}
      onOpenChange={onOpenChange}
      onClaimed={() => setClaimed(true)}
      user={user}
    />
  );
};
