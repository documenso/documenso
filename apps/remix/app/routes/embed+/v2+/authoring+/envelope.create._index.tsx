import { useLayoutEffect, useMemo, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react/macro';
import {
  DocumentStatus,
  EnvelopeType,
  ReadStatus,
  SendStatus,
  SigningStatus,
} from '@prisma/client';
import { CheckCircle2Icon } from 'lucide-react';

import { EnvelopeEditorProvider } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import type { SupportedLanguageCodes } from '@documenso/lib/constants/i18n';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { getTeamSettings } from '@documenso/lib/server-only/team/get-team-settings';
import { ZDefaultRecipientsSchema } from '@documenso/lib/types/default-recipients';
import type { TDocumentMetaDateFormat } from '@documenso/lib/types/document-meta';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import {
  type TEmbedCreateEnvelopeAuthoring,
  ZEmbedCreateEnvelopeAuthoringSchema,
} from '@documenso/lib/types/envelope-editor';
import type { TEnvelopeFieldAndMeta } from '@documenso/lib/types/field-meta';
import { extractDerivedDocumentMeta } from '@documenso/lib/utils/document';
import { buildEmbeddedFeatures } from '@documenso/lib/utils/embed-config';
import { buildEmbeddedEditorOptions } from '@documenso/lib/utils/embed-config';
import { trpc } from '@documenso/trpc/react';
import type { TCreateEnvelopePayload } from '@documenso/trpc/server/envelope-router/create-envelope.types';
import { Spinner } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { EnvelopeEditor } from '~/components/general/envelope-editor/envelope-editor';
import { EnvelopeEditorRenderProviderWrapper } from '~/components/general/envelope-editor/envelope-editor-renderer-provider-wrapper';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/envelope.create._index';

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);

  // We know that the token is present because we're checking it in the parent _layout route
  const token = url.searchParams.get('token') || '';

  if (!token) {
    throw new Response('Invalid token', { status: 404 });
  }

  // We also know that the token is valid, but we need the userId + teamId
  const result = await verifyEmbeddingPresignToken({ token }).catch(() => null);

  if (!result) {
    throw new Response('Invalid token', { status: 404 });
  }

  const teamSettings = await getTeamSettings({
    userId: result.userId,
    teamId: result.teamId,
  });

  return superLoaderJson({
    token,
    tokenUserId: result.userId,
    tokenTeamId: result.teamId,
    teamSettings,
  });
};

export default function EmbeddingAuthoringEnvelopeCreatePage() {
  const [hasInitialized, setHasInitialized] = useState(false);
  const [embedAuthoringOptions, setEmbedAuthoringOptions] =
    useState<TEmbedCreateEnvelopeAuthoring | null>(null);

  useLayoutEffect(() => {
    try {
      const hash = window.location.hash.slice(1);

      if (hash) {
        const result = ZEmbedCreateEnvelopeAuthoringSchema.safeParse(
          JSON.parse(decodeURIComponent(atob(hash))),
        );

        if (result.success) {
          setEmbedAuthoringOptions({
            ...result.data,
            features: buildEmbeddedFeatures(result.data.features),
          });
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

  return <EnvelopeCreatePage embedAuthoringOptions={embedAuthoringOptions} />;
}

type EnvelopeCreatePageProps = {
  embedAuthoringOptions: TEmbedCreateEnvelopeAuthoring;
};

const EnvelopeCreatePage = ({ embedAuthoringOptions }: EnvelopeCreatePageProps) => {
  const { token, tokenUserId, tokenTeamId, teamSettings } = useSuperLoaderData<typeof loader>();

  const { t } = useLingui();
  const { toast } = useToast();

  const [isCreatingEnvelope, setIsCreatingEnvelope] = useState(false);
  const [createdEnvelope, setCreatedEnvelope] = useState<{ id: string } | null>(null);

  const { mutateAsync: createEmbeddingEnvelope } =
    trpc.embeddingPresign.createEmbeddingEnvelope.useMutation();

  const buildCreateEnvelopeRequest = (
    envelope: Omit<TEditorEnvelope, 'id'>,
  ): { payload: TCreateEnvelopePayload; files: File[] } => {
    const sortedItems = [...envelope.envelopeItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const itemIdToIndex = new Map<string, number>();

    sortedItems.forEach((item, index) => {
      itemIdToIndex.set(String(item.id), index);
    });

    const files: File[] = [];

    for (const item of sortedItems) {
      if (!item.data) {
        throw new Error(`Envelope item "${item.title ?? item.id}" has no PDF data`);
      }

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

    const recipients = envelope.recipients.map((recipient) => {
      const recipientFields = envelope.fields.filter((f) => f.recipientId === recipient.id);

      const fields = recipientFields.map((field) => {
        return {
          identifier: itemIdToIndex.get(String(field.envelopeItemId)),
          page: field.page,
          positionX: Number(field.positionX),
          positionY: Number(field.positionY),
          width: Number(field.width),
          height: Number(field.height),
          ...({
            type: field.type,
            fieldMeta: field.fieldMeta ?? undefined,
          } as TEnvelopeFieldAndMeta),
        };
      });

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

    const payload: TCreateEnvelopePayload = {
      title: envelope.title,
      type: envelope.type,
      externalId: envelope.externalId ?? undefined,
      visibility: envelope.visibility,
      globalAccessAuth: envelope.authOptions?.globalAccessAuth?.length
        ? envelope.authOptions?.globalAccessAuth
        : undefined,
      globalActionAuth: envelope.authOptions?.globalActionAuth?.length
        ? envelope.authOptions?.globalActionAuth
        : undefined,
      folderId: envelope.folderId ?? undefined,
      recipients,
      meta: {
        subject: envelope.documentMeta.subject ?? undefined,
        message: envelope.documentMeta.message ?? undefined,
        timezone: envelope.documentMeta.timezone ?? undefined,
        dateFormat: (envelope.documentMeta.dateFormat as TDocumentMetaDateFormat) ?? undefined,
        distributionMethod: envelope.documentMeta.distributionMethod ?? undefined,
        signingOrder: envelope.documentMeta.signingOrder ?? undefined,
        allowDictateNextSigner: envelope.documentMeta.allowDictateNextSigner ?? undefined,
        redirectUrl: envelope.documentMeta.redirectUrl ?? undefined,
        language: envelope.documentMeta.language as SupportedLanguageCodes,
        typedSignatureEnabled: envelope.documentMeta.typedSignatureEnabled ?? undefined,
        uploadSignatureEnabled: envelope.documentMeta.uploadSignatureEnabled ?? undefined,
        drawSignatureEnabled: envelope.documentMeta.drawSignatureEnabled ?? undefined,
        emailId: envelope.documentMeta.emailId ?? undefined,
        emailReplyTo: envelope.documentMeta.emailReplyTo ?? undefined,
        emailSettings: envelope.documentMeta.emailSettings ?? undefined,
      },
    };

    return { payload, files };
  };

  const createEmbeddedEnvelope = async (envelopeWithoutId: Omit<TEditorEnvelope, 'id'>) => {
    setIsCreatingEnvelope(true);

    if (isCreatingEnvelope) {
      return;
    }

    try {
      const { payload, files } = buildCreateEnvelopeRequest(envelopeWithoutId);

      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));

      for (const file of files) {
        formData.append('files', file);
      }

      const { id } = await createEmbeddingEnvelope(formData);

      // Send a message to the parent window with the document details
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'envelope-created',
            envelopeId: id,
            externalId: envelopeWithoutId.externalId,
          },
          '*',
        );
      }

      setCreatedEnvelope({ id });
    } catch (err) {
      console.error('Failed to create envelope:', err);

      toast({
        variant: 'destructive',
        title: t`Error`,
        description: t`Failed to create document. Please try again.`,
      });
    }

    setIsCreatingEnvelope(false);
  };

  const embeded = useMemo(
    () => ({
      presignToken: token,
      mode: 'create' as const,
      onCreate: async (envelope: Omit<TEditorEnvelope, 'id'>) => createEmbeddedEnvelope(envelope),
      customBrandingLogo: Boolean(teamSettings.brandingEnabled && teamSettings.brandingLogo),
    }),
    [token],
  );

  const editorConfig = useMemo(() => {
    return buildEmbeddedEditorOptions(embedAuthoringOptions.features, embeded);
  }, [embedAuthoringOptions.features, embeded]);

  const initialEnvelope = useMemo((): TEditorEnvelope => {
    const defaultDocumentMeta = extractDerivedDocumentMeta(teamSettings, undefined);

    const defaultRecipients = teamSettings.defaultRecipients
      ? ZDefaultRecipientsSchema.parse(teamSettings.defaultRecipients)
      : [];

    const recipients: TEditorEnvelope['recipients'] = defaultRecipients.map((recipient, index) => ({
      id: -(index + 1),
      envelopeId: '',
      email: recipient.email,
      name: recipient.name,
      role: recipient.role,
      token: '',
      readStatus: ReadStatus.NOT_OPENED,
      signingStatus: SigningStatus.NOT_SIGNED,
      sendStatus: SendStatus.NOT_SENT,
      documentDeletedAt: null,
      expired: null,
      signedAt: null,
      authOptions: {
        accessAuth: [],
        actionAuth: [],
      },
      signingOrder: index + 1,
      rejectionReason: null,
    }));

    const type = embedAuthoringOptions.type;

    return {
      id: '',
      secondaryId: '',
      internalVersion: 2,
      type,
      status: DocumentStatus.DRAFT,
      source: 'DOCUMENT',
      visibility: teamSettings.documentVisibility,
      templateType: 'PRIVATE',
      completedAt: null,
      deletedAt: null,
      title: type === EnvelopeType.DOCUMENT ? 'Document Title' : 'Template Title',
      authOptions: {
        globalAccessAuth: [],
        globalActionAuth: [],
      },
      publicTitle: '',
      publicDescription: '',
      userId: tokenUserId,
      teamId: tokenTeamId,
      folderId: null,
      documentMeta: {
        id: '',
        ...defaultDocumentMeta,
      },
      recipients,
      fields: [],
      envelopeItems: [],
      directLink: null,
      team: {
        id: tokenTeamId,
        url: '',
      },
      user: {
        id: tokenUserId,
        name: '',
        email: '',
      },
      externalId: embedAuthoringOptions?.externalId ?? null,
    };
  }, []);

  return (
    <div className="min-w-screen relative min-h-screen">
      {isCreatingEnvelope && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background">
          <Spinner />

          <p className="mt-2 text-sm text-muted-foreground">
            {initialEnvelope.type === EnvelopeType.DOCUMENT ? (
              <Trans>Creating Document</Trans>
            ) : (
              <Trans>Creating Template</Trans>
            )}
          </p>
        </div>
      )}

      {createdEnvelope && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background">
          <div className="mx-auto w-full max-w-md text-center">
            <CheckCircle2Icon className="mx-auto h-16 w-16 text-primary" />

            <h1 className="mt-6 text-2xl font-bold">
              {initialEnvelope.type === EnvelopeType.TEMPLATE ? (
                <Trans>Template Created</Trans>
              ) : (
                <Trans>Document Created</Trans>
              )}
            </h1>

            <p className="mt-2 text-muted-foreground">
              {initialEnvelope.type === EnvelopeType.TEMPLATE ? (
                <Trans>Your template has been created successfully</Trans>
              ) : (
                <Trans>Your document has been created successfully</Trans>
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
