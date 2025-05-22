import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { authClient } from '@documenso/auth/client';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';

export const SessionLogoutAllDialog = () => {
  const { _ } = useLingui();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">{_(msg`Log out of all devices`)}</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{_(msg`Log out of all devices`)}</DialogTitle>
          <DialogDescription>
            {_(msg`Are you sure you want to log out of all devices?`)}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <div className="flex w-full flex-1 flex-row justify-end gap-x-2">
            <DialogClose asChild>
              <Button variant="secondary">{_(msg`Cancel`)}</Button>
            </DialogClose>

            <Button
              variant="destructive"
              onClick={async () =>
                authClient.signOutAllSessions({ redirectPath: '/settings/security/sessions' })
              }
            >
              {_(msg`Log out of all devices`)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
