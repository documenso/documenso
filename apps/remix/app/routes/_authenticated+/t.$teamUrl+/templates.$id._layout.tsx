import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { ChevronLeftIcon } from 'lucide-react';
import { Link, Outlet, isRouteErrorResponse, redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { Button } from '@documenso/ui/primitives/button';

import { GenericErrorLayout } from '~/components/general/generic-error-layout';

import type { Route } from './+types/settings._layout';

/**
 * This file is very similar for documents as well. Any changes here should also be adjusted there as well.
 *
 * File: apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents.$id._layout.tsx
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { id } = params;

  const templateId = Number(id);

  // If ID is a number, redirect to use envelope ID instead.
  if (!Number.isNaN(templateId)) {
    const { user } = await getSession(request);

    const team = await getTeamByUrl({
      userId: user.id,
      teamUrl: params.teamUrl,
    });

    const envelope = await getEnvelopeById({
      id: {
        type: 'templateId',
        id: templateId,
      },
      type: EnvelopeType.TEMPLATE,
      userId: user.id,
      teamId: team.id,
    }).catch((err) => {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.NOT_FOUND) {
        throw new Response('Not Found', { status: 404 });
      }

      throw err;
    });

    const url = new URL(request.url);

    throw redirect(url.pathname.replace(`/templates/${id}`, `/templates/${envelope.id}`));
  }
}

export default function TemplatesLayout() {
  return <Outlet />;
}

export function ErrorBoundary({ error, params }: Route.ErrorBoundaryProps) {
  const errorCode = isRouteErrorResponse(error) ? error.status : 500;

  const errorCodeMap = {
    404: {
      subHeading: msg`404 Template not found`,
      heading: msg`Oops! Something went wrong.`,
      message: msg`The template you are looking for could not be found.`,
    },
  };

  return (
    <GenericErrorLayout
      errorCode={errorCode}
      errorCodeMap={errorCodeMap}
      secondaryButton={null}
      primaryButton={
        <Button asChild className="w-32">
          <Link to={`/t/${params.teamUrl}/templates`}>
            <ChevronLeftIcon className="mr-2 h-4 w-4" />
            <Trans>Go Back</Trans>
          </Link>
        </Button>
      }
    />
  );
}
