'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BellIcon } from 'lucide-react';

import { formatTeamUrl } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';

import { AcceptTeamInvitationButton } from './accept-team-invitation-button';

export const TeamInvitations = () => {
  const { data, isInitialLoading } = trpc.team.getTeamInvitations.useQuery();

  return (
    <AnimatePresence>
      {data && data.length > 0 && !isInitialLoading && (
        <motion.div
          className="mt-8 flex flex-row items-center justify-between rounded-md bg-blue-50 p-6"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
          }}
        >
          {/* Todo: Teams - Extract into `Alerts` component? */}
          <BellIcon className="mr-4 h-5 w-5 text-blue-800" />

          <div className="text-sm text-blue-700">
            You have <strong>{data.length}</strong> pending team invitation
            {data.length > 1 ? 's' : ''}.
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <button className="ml-auto text-sm font-medium text-blue-700 hover:text-blue-600">
                View invites
              </button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pending invitations</DialogTitle>

                <DialogDescription className="mt-4">
                  You have {data.length} pending team invitation{data.length > 1 ? 's' : ''}.
                </DialogDescription>
              </DialogHeader>

              <ul className="-mx-6 -mb-6 max-h-[80vh] divide-y overflow-auto px-6 pb-6 xl:max-h-[70vh]">
                {data.map((invitation) => (
                  <li key={invitation.teamId}>
                    <AvatarWithText
                      className="w-full max-w-none py-4"
                      avatarFallback={invitation.team.name.slice(0, 1)}
                      primaryText={
                        <span className="text-foreground/80 font-semibold">
                          {invitation.team.name}
                        </span>
                      }
                      secondaryText={formatTeamUrl(invitation.team.url)}
                      rightSideComponent={
                        <div className="ml-auto">
                          <AcceptTeamInvitationButton teamId={invitation.team.id} />
                        </div>
                      }
                    />
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
