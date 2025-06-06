import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';

import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { MultiSelectCombobox } from '@documenso/ui/primitives/multi-select-combobox';

export interface Member {
  email: string;
  name: string;
}

export type TeamMemberSelectDialogProps = {
  trigger?: React.ReactNode;
  onSubmit: (members: Member[]) => void;
  teamId: number;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const TeamMemberSelectDialog = ({
  trigger,
  teamId,
  ...props
}: TeamMemberSelectDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  const isMounted = useIsMounted();

  const { data, isLoading } = trpc.team.getTeamMembers.useQuery({
    teamId,
  });

  const comboBoxOptions = (data ?? []).map((member) => ({
    label: member.user.name ?? member.user.email,
    value: member.user.id,
  }));

  const onSubmit = () => {
    props.onSubmit(
      selectedMemberIds
        .map((mid) => {
          const m = (data ?? []).find((member) => member.user.id === mid);
          return m ? { email: m.user.email, name: m.user.name || '' } : null;
        })
        .filter((v) => v !== null),
    );
    setOpen(false);
  };

  return (
    <Dialog {...props} open={open} onOpenChange={(value) => setOpen(value)}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Trans>Select team member</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Select team member</Trans>
          </DialogTitle>
        </DialogHeader>

        <fieldset className="flex h-full flex-col">
          <MultiSelectCombobox
            emptySelectionPlaceholder={
              <p className="text-muted-foreground font-normal">
                <Trans>
                  <span className="text-muted-foreground/70">Member:</span> All
                </Trans>
              </p>
            }
            className="flex w-full flex-col"
            enableClearAllButton={true}
            inputPlaceholder={msg`Search`}
            loading={!isMounted || isLoading}
            options={comboBoxOptions}
            selectedValues={selectedMemberIds}
            onChange={setSelectedMemberIds}
          />

          <DialogFooter className="mt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button type="submit" onClick={() => onSubmit()}>
              <Trans>Add</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
