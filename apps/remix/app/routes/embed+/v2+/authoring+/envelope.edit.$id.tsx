import { useLayoutEffect, useMemo, useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { CheckCircle2Icon } from 'lucide-react';
import { redirect } from 'react-router';

import { EnvelopeEditorProvider } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import type { SupportedLanguageCodes } from '@documenso/lib/constants/i18n';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getTeamSettings } from '@documenso/lib/server-only/team/get-team-settings';
import type { TDocumentMetaDateFormat } from '@documenso/lib/types/document-meta';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import {
  type TEmbedEditEnvelopeAuthoring,
  ZEmbedEditEnvelopeAuthoringSchema,
} from '@documenso/lib/types/envelope-editor';
import type { TEnvelopeFieldAndMeta } from '@documenso/lib/types/field-meta';
import { buildEmbeddedEditorOptions } from '@documenso/lib/utils/embed-config';
import { trpc } from '@documenso/trpc/react';
import type { TUpdateEmbeddingEnvelopePayload } from '@documenso/trpc/server/embedding-router/update-embedding-envelope.types';
import { Spinner } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { EnvelopeEditor } from '~/components/general/envelope-editor/envelope-editor';
import { EnvelopeEditorRenderProviderWrapper } from '~/components/general/envelope-editor/envelope-editor-renderer-provider-wrapper';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/envelope.edit.$id';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const url = new URL(request.url);

  const { id } = params;

  if (!id || !id.startsWith('envelope_')) {
    throw redirect(`/embed/v2/authoring/error/not-found`);
  }

  // We know that the token is present because we're checking it in the parent _layout route
  const token = url.searchParams.get('token') || '';

  if (!token) {
    throw new Response('Invalid token', { status: 404 });
  }

  // We also know that the token is valid, but we need the userId + teamId
  const result = await verifyEmbeddingPresignToken({ token, scope: `envelopeId:${id}` }).catch(
    () => null,
  );

  if (!result) {
    throw new Error('Invalid token');
  }

  const settings = await getTeamSettings({
    userId: result.userId,
    teamId: result.teamId,
  });

  const envelope = await getEnvelopeById({
    id: {
      type: 'envelopeId',
      id,
    },
    type: null,
    userId: result.userId,
    teamId: result.teamId,
  }).catch(() => null);

  if (!envelope) {
    throw redirect(`/embed/v2/authoring/error/not-found`);
  }

  let brandingLogo: string | undefined = undefined;

  if (settings.brandingEnabled && settings.brandingLogo) {
    brandingLogo = settings.brandingLogo;
  }

  return superLoaderJson({
    token,
    envelope,
    brandingLogo,
  });
};

export default function EmbeddingAuthoringEnvelopeEditPage() {
  const [hasInitialized, setHasInitialized] = useState(false);
  const [embedAuthoringOptions, setEmbedAuthoringOptions] =
    useState<TEmbedEditEnvelopeAuthoring | null>(null);

  useLayoutEffect(() => {
    try {
      const hash = window.location.hash.slice(1);

      if (hash) {
        const result = ZEmbedEditEnvelopeAuthoringSchema.safeParse(
          JSON.parse(decodeURIComponent(atob(hash))),
        );

        if (result.success) {
          setEmbedAuthoringOptions(result.data);
        }
      }
    } catch (err) {
      console.error('Error parsing embedding params:', err);
    }

    setHasInitialized(true);
  }, []);

  if (!hasInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!embedAuthoringOptions) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Trans>Invalid Embedding Parameters</Trans>
      </div>
    );
  }

  return <EnvelopeEditPage embedAuthoringOptions={embedAuthoringOptions} />;
}

type EnvelopeEditPageProps = {
  embedAuthoringOptions: TEmbedEditEnvelopeAuthoring;
};

const EnvelopeEditPage = ({ embedAuthoringOptions }: EnvelopeEditPageProps) => {
  const { envelope, token, brandingLogo } = useSuperLoaderData<typeof loader>();

  const { t } = useLingui();
  const { toast } = useToast();

  const [isUpdatingEnvelope, setIsUpdatingEnvelope] = useState(false);
  const [updatedEnvelope, setUpdatedEnvelope] = useState<{ id: string } | null>(null);

  const { mutateAsync: updateEmbeddingEnvelope } =
    trpc.embeddingPresign.updateEmbeddingEnvelope.useMutation();

  const buildUpdateEnvelopeRequest = (
    envelope: TEditorEnvelope,
  ): { payload: TUpdateEmbeddingEnvelopePayload; files: File[] } => {
    const files: File[] = [];

    const envelopeItems = envelope.envelopeItems.map((item) => {
      // Attach any new envelope item files to the request.
      if (item.data) {
        files.push(
          new File(
            [item.data],
            item.title?.endsWith('.pdf') ? item.title : `${item.title ?? 'document'}.pdf`,
            {
              type: 'application/pdf',
            },
          ),
        );
      }

      return {
        id: item.id,
        title: item.title,
        order: item.order,
        index: item.data ? files.length - 1 : undefined,
      };
    });

    const recipients = envelope.recipients.map((recipient) => {
      const recipientFields = envelope.fields.filter((f) => f.recipientId === recipient.id);

      const fields = recipientFields.map((field) => ({
        id: field.id,
        envelopeItemId: field.envelopeItemId,
        page: field.page,
        positionX: Number(field.positionX),
        positionY: Number(field.positionY),
        width: Number(field.width),
        height: Number(field.height),
        ...({
          type: field.type,
          fieldMeta: field.fieldMeta ?? undefined,
        } as TEnvelopeFieldAndMeta),
      }));

      return {
        email: recipient.email,
        name: recipient.name,
        role: recipient.role,
        signingOrder: recipient.signingOrder ?? undefined,
        accessAuth: recipient.authOptions?.accessAuth ?? [],
        actionAuth: recipient.authOptions?.actionAuth ?? [],
        fields,
      };
    });

    const payload: TUpdateEmbeddingEnvelopePayload = {
      envelopeId: envelope.id,
      data: {
        title: envelope.title,
        externalId: envelope.externalId,
        visibility: envelope.visibility,
        globalAccessAuth: envelope.authOptions?.globalAccessAuth,
        globalActionAuth: envelope.authOptions?.globalActionAuth,
        folderId: envelope.folderId,
        recipients,
        envelopeItems,
      },
      meta: {
        subject: envelope.documentMeta.subject ?? undefined,
        message: envelope.documentMeta.message ?? undefined,
        timezone: envelope.documentMeta.timezone ?? undefined,
        distributionMethod: envelope.documentMeta.distributionMethod ?? undefined,
        signingOrder: envelope.documentMeta.signingOrder ?? undefined,
        allowDictateNextSigner: envelope.documentMeta.allowDictateNextSigner ?? undefined,
        redirectUrl: envelope.documentMeta.redirectUrl ?? undefined,
        typedSignatureEnabled: envelope.documentMeta.typedSignatureEnabled ?? undefined,
        uploadSignatureEnabled: envelope.documentMeta.uploadSignatureEnabled ?? undefined,
        drawSignatureEnabled: envelope.documentMeta.drawSignatureEnabled ?? undefined,
        emailId: envelope.documentMeta.emailId ?? undefined,
        emailReplyTo: envelope.documentMeta.emailReplyTo ?? undefined,
        emailSettings: envelope.documentMeta.emailSettings ?? undefined,
        dateFormat: (envelope.documentMeta.dateFormat as TDocumentMetaDateFormat) ?? undefined,
        language: envelope.documentMeta.language as SupportedLanguageCodes,
      },
    };

    return { payload, files };
  };

  const updateEmbeddedEnvelope = async (envelope: TEditorEnvelope) => {
    setIsUpdatingEnvelope(true);

    if (isUpdatingEnvelope) {
      return;
    }

    try {
      const { payload, files } = buildUpdateEnvelopeRequest(envelope);

      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));

      for (const file of files) {
        formData.append('files', file);
      }

      await updateEmbeddingEnvelope(formData);

      // Send a message to the parent window with the document details
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'envelope-updated',
            envelopeId: envelope.id,
            externalId: envelope.externalId || null,
          },
          '*',
        );
      }

      // Navigate to the completion page.
      setUpdatedEnvelope({ id: envelope.id });
    } catch (err) {
      console.error('Failed to update envelope:', err);

      toast({
        variant: 'destructive',
        title: t`Error`,
        description: t`Failed to update envelope. Please try again.`,
      });
    }

    setIsUpdatingEnvelope(false);
  };

  const embeded = useMemo(
    () => ({
      presignToken: token,
      mode: 'edit' as const,
      onUpdate: async (envelope: TEditorEnvelope) => updateEmbeddedEnvelope(envelope),
      brandingLogo,
    }),
    [token],
  );

  const editorConfig = useMemo(() => {
    return buildEmbeddedEditorOptions(embedAuthoringOptions.features, embeded);
  }, [embedAuthoringOptions.features, embeded]);

  const initialEnvelope = useMemo(
    () => ({
      ...envelope,
      externalId: embedAuthoringOptions?.externalId || envelope.externalId || null,
    }),
    [envelope, embedAuthoringOptions?.externalId],
  );

  return (
    <div className="min-w-screen relative min-h-screen">
      {isUpdatingEnvelope && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background">
          <Spinner />

          <p className="mt-2 text-sm text-muted-foreground">
            {envelope.type === EnvelopeType.DOCUMENT ? (
              <Trans>Updating Document</Trans>
            ) : (
              <Trans>Updating Template</Trans>
            )}
          </p>
        </div>
      )}

      {updatedEnvelope && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background">
          <div className="mx-auto w-full max-w-md text-center">
            <CheckCircle2Icon className="mx-auto h-16 w-16 text-primary" />

            <h1 className="mt-6 text-2xl font-bold">
              {envelope.type === EnvelopeType.TEMPLATE ? (
                <Trans>Template Updated</Trans>
              ) : (
                <Trans>Document Updated</Trans>
              )}
            </h1>

            <p className="mt-2 text-muted-foreground">
              {envelope.type === EnvelopeType.TEMPLATE ? (
                <Trans>Your template has been updated successfully</Trans>
              ) : (
                <Trans>Your document has been updated successfully</Trans>
              )}
            </p>
          </div>
        </div>
      )}

      <EnvelopeEditorProvider initialEnvelope={initialEnvelope} editorConfig={editorConfig}>
        <EnvelopeEditorRenderProviderWrapper presignedToken={token}>
          <EnvelopeEditor />
        </EnvelopeEditorRenderProviderWrapper>
      </EnvelopeEditorProvider>
    </div>
  );
};
