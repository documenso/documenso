import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { SUITEOP_REDIRECT_URL } from '@documenso/lib/constants/app';
import { createAuthorization } from '@documenso/lib/server-only/suiteop/create-authorization';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';
import { Button } from '@documenso/ui/primitives/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@documenso/ui/primitives/card';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';

import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/oauth.suiteop.authorize';

export function meta() {
  return appMetaTags('Authorize SuiteOp');
}

/**
 * Validates that a redirect URL is on the app.suiteop.com domain
 */
function validateRedirectUrl(redirectUrl: string | null): string {
  if (!redirectUrl) {
    return SUITEOP_REDIRECT_URL;
  }

  try {
    const url = new URL(redirectUrl);

    // Must be on app.suiteop.com domain
    if (url.hostname !== 'app.suiteop.com') {
      throw new Error('Redirect URL must be on app.suiteop.com domain');
    }

    return redirectUrl;
  } catch (error) {
    throw new Error('Invalid redirect URL format');
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);

  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const redirectUrlParam = url.searchParams.get('redirectUrl') || '';

  // Validate redirect URL if provided, otherwise use default
  let redirectUrl: string;
  try {
    redirectUrl = validateRedirectUrl(redirectUrlParam || null);
  } catch (error) {
    // If invalid, use default
    redirectUrl = SUITEOP_REDIRECT_URL;
  }

  const teams = await getTeams({ userId: session.user.id });

  return {
    teams,
    state,
    redirectUrl,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request);

  const formData = await request.formData();
  const teamId = Number(formData.get('teamId'));
  const state = formData.get('state')?.toString() || '';
  const redirectUrlParam = formData.get('redirectUrl')?.toString() || '';

  if (!teamId || isNaN(teamId)) {
    throw new Error('Invalid team ID');
  }

  // Validate redirect URL is on app.suiteop.com domain
  const redirectUrl = validateRedirectUrl(redirectUrlParam || null);
  const redirectUrlObj = new URL(redirectUrl);

  const { claimCode } = await createAuthorization({
    userId: session.user.id,
    teamId,
    state,
  });

  // Redirect to SuiteOp callback URL
  redirectUrlObj.searchParams.set('code', claimCode);
  if (state) {
    redirectUrlObj.searchParams.set('state', state);
  }

  throw redirect(redirectUrlObj.toString());
}

export default function OAuthSuiteOpAuthorizePage({ loaderData }: Route.ComponentProps) {
  const { teams, state, redirectUrl } = loaderData;

  // Initialize state at the top level (required for React hooks)
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id.toString() || '');

  // No teams - show message
  if (teams.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>No Teams Found</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>You need to create a team before you can connect SuiteOp.</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/o/new/teams">
                <Trans>Create Team</Trans>
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Single team - auto-select
  if (teams.length === 1) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Authorize SuiteOp</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>Click below to authorize SuiteOp to access your team: {teams[0].name}</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post">
              <input type="hidden" name="teamId" value={teams[0].id} />
              {state && <input type="hidden" name="state" value={state} />}
              <input type="hidden" name="redirectUrl" value={redirectUrl} />
              <Button type="submit">
                <Trans>Authorize SuiteOp</Trans>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Multiple teams - show selection

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Authorize SuiteOp</Trans>
          </CardTitle>
          <CardDescription>
            <Trans>Select which team you want to connect with SuiteOp:</Trans>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="post">
            {state && <input type="hidden" name="state" value={state} />}
            <input type="hidden" name="teamId" value={selectedTeamId} />
            <input type="hidden" name="redirectUrl" value={redirectUrl} />
            <RadioGroup
              value={selectedTeamId}
              onValueChange={setSelectedTeamId}
              className="space-y-4"
            >
              {teams.map((team) => (
                <label
                  key={team.id}
                  htmlFor={`team-${team.id}`}
                  className="hover:bg-muted/50 flex cursor-pointer items-center space-x-3 rounded-lg border p-4"
                >
                  <RadioGroupItem value={team.id.toString()} id={`team-${team.id}`} />
                  <div className="flex-1">
                    <div className="font-medium">{team.name}</div>
                  </div>
                </label>
              ))}
            </RadioGroup>
            <div className="mt-6">
              <Button type="submit">
                <Trans>Authorize SuiteOp</Trans>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
