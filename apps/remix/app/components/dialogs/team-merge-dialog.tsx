// ABOUTME: Dialog for merging teams — destination picker, impact preview, confirmation input.
// ABOUTME: Opened when 2+ teams are selected on the org teams settings page.
import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamMergeDialogProps = {
  sourceTeamIds: number[];
  onMerged?: () => void;
};

const CREATE_NEW_VALUE = '__create_new__';

export const TeamMergeDialog = ({ sourceTeamIds, onMerged }: TeamMergeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [destinationValue, setDestinationValue] = useState<string>('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamUrl, setNewTeamUrl] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();
  const organisation = useCurrentOrganisation();

  const sourceSet = useMemo(() => new Set(sourceTeamIds), [sourceTeamIds]);

  const availableDestinations = useMemo(
    () => organisation.teams.filter((t) => !sourceSet.has(t.id)),
    [organisation.teams, sourceSet],
  );

  const isCreatingNew = destinationValue === CREATE_NEW_VALUE;
  const destinationTeamId =
    !isCreatingNew && destinationValue ? parseInt(destinationValue, 10) : undefined;

  const destinationName = isCreatingNew
    ? newTeamName
    : (organisation.teams.find((t) => t.id === destinationTeamId)?.name ?? '');

  const confirmationMatch = confirmText === destinationName && destinationName.length > 0;

  const previewQuery = trpc.team.mergePreview.useQuery(
    {
      organisationId: organisation.id,
      sourceTeamIds,
      destinationTeamId,
    },
    {
      enabled: open && sourceTeamIds.length > 0 && !!destinationTeamId,
    },
  );

  const { mutateAsync: mergeTeamsMutation, isPending } = trpc.team.merge.useMutation();

  const onSubmit = async () => {
    try {
      await mergeTeamsMutation({
        organisationId: organisation.id,
        sourceTeamIds,
        destinationTeamId,
        newTeamName: isCreatingNew ? newTeamName : undefined,
        newTeamUrl: isCreatingNew ? newTeamUrl : undefined,
      });

      await refreshSession();

      toast({
        title: _(msg`Teams merged`),
        description: _(msg`Teams have been merged successfully.`),
        duration: 5000,
      });

      setOpen(false);
      onMerged?.();
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: _(msg`Failed to merge teams`),
        description: error.message || _(msg`An unknown error occurred.`),
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  useEffect(() => {
    if (!open) {
      setDestinationValue('');
      setNewTeamName('');
      setNewTeamUrl('');
      setConfirmText('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trans>Merge Teams</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent position="center" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Trans>Merge Teams</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Merge {sourceTeamIds.length} selected teams into a destination team.</Trans>
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col space-y-4" disabled={isPending}>
          <div>
            <Label>
              <Trans>Destination team</Trans>
            </Label>
            <Select value={destinationValue} onValueChange={setDestinationValue}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={_(msg`Select destination...`)} />
              </SelectTrigger>
              <SelectContent>
                {availableDestinations.map((team) => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.name}
                  </SelectItem>
                ))}
                <SelectItem value={CREATE_NEW_VALUE}>
                  <Trans>+ Create new team</Trans>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCreatingNew && (
            <div className="space-y-3">
              <div>
                <Label>
                  <Trans>Team name</Trans>
                </Label>
                <Input
                  className="mt-1"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder={_(msg`New team name`)}
                />
              </div>
              <div>
                <Label>
                  <Trans>Team URL</Trans>
                </Label>
                <Input
                  className="mt-1"
                  value={newTeamUrl}
                  onChange={(e) => setNewTeamUrl(e.target.value)}
                  placeholder={_(msg`new-team-url`)}
                />
              </div>
            </div>
          )}

          {previewQuery.data && (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">
                <Trans>Impact summary</Trans>
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">
                  <Trans>Documents</Trans>
                </span>
                <span>{previewQuery.data.moving.documents}</span>
                <span className="text-muted-foreground">
                  <Trans>Templates</Trans>
                </span>
                <span>{previewQuery.data.moving.templates}</span>
                <span className="text-muted-foreground">
                  <Trans>Folders</Trans>
                </span>
                <span>{previewQuery.data.moving.folders}</span>
                <span className="text-muted-foreground">
                  <Trans>Members</Trans>
                </span>
                <span>{previewQuery.data.moving.members}</span>
              </div>
              {(previewQuery.data.discarding.webhooks > 0 ||
                previewQuery.data.discarding.apiTokens > 0 ||
                previewQuery.data.discarding.teamEmails > 0) && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  <p className="col-span-2 font-medium text-destructive">
                    <Trans>Will be discarded</Trans>
                  </p>
                  {previewQuery.data.discarding.webhooks > 0 && (
                    <>
                      <span className="text-muted-foreground">
                        <Trans>Webhooks</Trans>
                      </span>
                      <span>{previewQuery.data.discarding.webhooks}</span>
                    </>
                  )}
                  {previewQuery.data.discarding.apiTokens > 0 && (
                    <>
                      <span className="text-muted-foreground">
                        <Trans>API tokens</Trans>
                      </span>
                      <span>{previewQuery.data.discarding.apiTokens}</span>
                    </>
                  )}
                  {previewQuery.data.discarding.teamEmails > 0 && (
                    <>
                      <span className="text-muted-foreground">
                        <Trans>Team emails</Trans>
                      </span>
                      <span>{previewQuery.data.discarding.teamEmails}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <Alert variant="destructive">
            <AlertDescription>
              <Trans>
                This action cannot be undone. All documents, templates, and folders from the
                selected teams will be moved to the destination team. Source team webhooks, API
                tokens, email configurations, and settings will be permanently deleted. Source teams
                will be removed.
              </Trans>
            </AlertDescription>
          </Alert>

          <div>
            <Label>
              <Trans>
                Type <span className="font-semibold text-destructive">{destinationName}</span> to
                confirm
              </Trans>
            </Label>
            <Input
              className="mt-1"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={destinationName}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>
            <Button
              variant="destructive"
              loading={isPending}
              disabled={!confirmationMatch || isPending}
              onClick={onSubmit}
            >
              <Trans>Merge Teams</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
