'use client';

import { useCallback, useEffect, useState } from 'react';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import type { User } from '@documenso/prisma/client';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { ClaimPublicProfileDialogForm } from '~/components/forms/public-profile-claim-dialog';

export type UpcomingProfileClaimTeaserProps = {
  user: User;
};

export const UpcomingProfileClaimTeaser = ({ user }: UpcomingProfileClaimTeaserProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !claimed) {
        toast({
          title: _(msg`Claim your profile later`),
          description: _(
            msg`You can claim your profile later on by going to your profile settings!`,
          ),
        });
      }

      setOpen(open);
      localStorage.setItem('app.hasShownProfileClaimDialog', 'true');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
