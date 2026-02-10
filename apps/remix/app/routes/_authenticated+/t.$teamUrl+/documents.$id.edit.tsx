import { useEffect } from 'react';

import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { Link, useNavigate } from 'react-router';

import { EnvelopeEditorProvider } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { EnvelopeRenderProvider } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Spinner } from '@documenso/ui/primitives/spinner';

import EnvelopeEditor from '~/components/general/envelope-editor/envelope-editor';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { useCurrentTeam } from '~/providers/team';

import type { Route } from './+types/documents.$id.edit';

export default function EnvelopeEditorPage({ params }: Route.ComponentProps) {
  const navigate = useNavigate();
  const team = useCurrentTeam();

  const {
    data: envelope,
    isLoading: isLoadingEnvelope,
    isError: isErrorEnvelope,
  } = trpc.envelope.get.useQuery(
    {
      envelopeId: params.id,
    },
    {
      retry: false,
    },
  );

  /**
   * Need to handle redirecting to legacy editor on the client side to reduce server
   * requests for the majority use case.
   */
  useEffect(() => {
    if (!envelope) {
      return;
    }

    const pathPrefix =
      envelope.type === EnvelopeType.DOCUMENT
        ? formatDocumentsPath(team.url)
        : formatTemplatesPath(team.url);

    if (envelope.teamId !== team.id) {
      void navigate(pathPrefix, { replace: true });
    } else if (envelope.internalVersion !== 2) {
      void navigate(`${pathPrefix}/${envelope.id}/legacy_editor`, { replace: true });
    }
  }, [envelope, team, navigate]);

  if (envelope && (envelope.teamId !== team.id || envelope.internalVersion !== 2)) {
    return (
      <div className="text-foreground flex h-screen w-screen flex-col items-center justify-center gap-2">
        <Spinner />
        <Trans>Redirecting</Trans>
      </div>
    );
  }

  if (isLoadingEnvelope) {
    return (
      <div className="text-foreground flex h-screen w-screen flex-col items-center justify-center gap-2">
        <Spinner />
        <Trans>Loading</Trans>
      </div>
    );
  }

  if (isErrorEnvelope || !envelope) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Not found`,
            subHeading: msg`404 Not found`,
            message: msg`The document you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/t/${team.url}/documents`}>
              <Trans>Go home</Trans>
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <EnvelopeEditorProvider initialEnvelope={envelope}>
      <EnvelopeRenderProvider
        envelope={envelope}
        token={undefined}
        fields={envelope.fields}
        recipients={envelope.recipients}
      >
        <EnvelopeEditor />
      </EnvelopeRenderProvider>
    </EnvelopeEditorProvider>
  );
}
