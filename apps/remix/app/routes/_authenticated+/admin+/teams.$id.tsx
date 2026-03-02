import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CopyIcon } from 'lucide-react';
import { Link } from 'react-router';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { DetailsCard, DetailsValue, formatIsoDate } from '~/components/general/admin-details';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';

import type { Route } from './+types/teams.$id';

export default function AdminTeamPage({ params }: Route.ComponentProps) {
  const { _ } = useLingui();
  const { toast } = useToast();

  const teamId = Number(params.id);

  const { data: team, isLoading } = trpc.admin.team.get.useQuery(
    {
      teamId,
    },
    {
      enabled: Number.isFinite(teamId) && teamId > 0,
    },
  );

  const onCopyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);

    toast({
      title: _(msg`Copied to clipboard`),
    });
  };

  if (!Number.isFinite(teamId) || teamId <= 0) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Team not found`,
            subHeading: msg`404 Team not found`,
            message: msg`The team you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/admin/organisations`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  if (isLoading) {
    return <SpinnerBox className="py-32" />;
  }

  if (!team) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Team not found`,
            subHeading: msg`404 Team not found`,
            message: msg`The team you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/admin/organisations`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <h2 className="text-4xl font-semibold">{team.name}</h2>

        <Button variant="outline" asChild>
          <Link to={`/admin/organisations/${team.organisation.id}`}>
            <Trans>Manage organisation</Trans>
          </Link>
        </Button>
      </div>

      <div className="mt-8 rounded-lg border p-4">
        <p className="text-sm font-medium">
          <Trans>Team details</Trans>
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <DetailsCard
            label={<Trans>Team ID</Trans>}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => void onCopyToClipboard(String(team.id))}
                title={_(msg`Copy team ID`)}
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            }
          >
            <DetailsValue isSelectable>{team.id}</DetailsValue>
          </DetailsCard>

          <DetailsCard label={<Trans>Team URL</Trans>}>
            <DetailsValue isSelectable>{team.url}</DetailsValue>
          </DetailsCard>

          <DetailsCard label={<Trans>Created</Trans>}>
            <DetailsValue>
              <span className="text-muted-foreground">{formatIsoDate(team.createdAt)}</span>
            </DetailsValue>
          </DetailsCard>

          <DetailsCard label={<Trans>Members</Trans>}>
            <DetailsValue>
              <span className="text-muted-foreground">{team.memberCount}</span>
            </DetailsValue>
          </DetailsCard>

          <DetailsCard
            label={<Trans>Organisation ID</Trans>}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => void onCopyToClipboard(team.organisation.id)}
                title={_(msg`Copy organisation ID`)}
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            }
          >
            <DetailsValue isSelectable>{team.organisation.id}</DetailsValue>
          </DetailsCard>
        </div>

        {team.teamEmail && (
          <div className="mt-4 text-sm text-muted-foreground">
            {team.teamEmail && (
              <div>
                <Trans>Team email</Trans>: {team.teamEmail.email} ({team.teamEmail.name})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
