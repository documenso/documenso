import { useLayoutEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DocumentDistributionMethod, DocumentSigningOrder, SigningStatus } from '@prisma/client';
import { redirect, useLoaderData } from 'react-router';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  isValidDateFormat,
} from '@documenso/lib/constants/date-formats';
import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { isValidLanguageCode } from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { nanoid } from '@documenso/lib/universal/id';
import { trpc } from '@documenso/trpc/react';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { ConfigureDocumentProvider } from '~/components/embed/authoring/configure-document-context';
import { ConfigureDocumentView } from '~/components/embed/authoring/configure-document-view';
import type { TConfigureEmbedFormSchema } from '~/components/embed/authoring/configure-document-view.types';
import { ConfigureFieldsView } from '~/components/embed/authoring/configure-fields-view';
import type { TConfigureFieldsFormSchema } from '~/components/embed/authoring/configure-fields-view.types';
import {
  type TBaseEmbedAuthoringSchema,
  ZBaseEmbedAuthoringEditSchema,
} from '~/types/embed-authoring-base-schema';

import type { Route } from './+types/document.edit.$id';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { id } = params;

  const url = new URL(request.url);

  // We know that the token is present because we're checking it in the parent _layout route
  const token = url.searchParams.get('token') || '';

  // We also know that the token is valid, but we need the userId + teamId
  const result = await verifyEmbeddingPresignToken({ token }).catch(() => null);

  if (!result) {
    throw new Error('Invalid token');
  }

  const documentId = Number(id);

  if (!documentId || Number.isNaN(documentId)) {
    redirect(`/embed/v1/authoring/error/not-found?documentId=${documentId}`);
  }

  const document = await getDocumentWithDetailsById({
    id: {
      type: 'documentId',
      id: documentId,
    },
    userId: result?.userId,
    teamId: result?.teamId ?? undefined,
  }).catch(() => null);

  if (!document) {
    throw redirect(`/embed/v1/authoring/error/not-found?documentId=${documentId}`);
  }

  const fields = document.fields.map((field) => ({
    ...field,
    positionX: field.positionX.toNumber(),
    positionY: field.positionY.toNumber(),
    width: field.width.toNumber(),
    height: field.height.toNumber(),
  }));

  return {
    token,
    document: {
      ...document,
      fields,
    },
  };
};

export default function EmbeddingAuthoringDocumentEditPage() {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { document, token } = useLoaderData<typeof loader>();

  const [hasFinishedInit, setHasFinishedInit] = useState(false);

  const signatureTypes = useMemo(() => {
    const types: string[] = [];

    if (document.documentMeta?.drawSignatureEnabled) {
      types.push(DocumentSignatureType.DRAW);
    }

    if (document.documentMeta?.typedSignatureEnabled) {
      types.push(DocumentSignatureType.TYPE);
    }

    if (document.documentMeta?.uploadSignatureEnabled) {
      types.push(DocumentSignatureType.UPLOAD);
    }

    return types;
  }, [document.documentMeta]);

  const [configuration, setConfiguration] = useState<TConfigureEmbedFormSchema | null>(() => ({
    title: document.title,
    documentData: undefined,
    meta: {
      subject: document.documentMeta?.subject ?? undefined,
      message: document.documentMeta?.message ?? undefined,
      distributionMethod:
        document.documentMeta?.distributionMethod ?? DocumentDistributionMethod.EMAIL,
      emailSettings: document.documentMeta?.emailSettings ?? ZDocumentEmailSettingsSchema.parse({}),
      timezone: document.documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
      signingOrder: document.documentMeta?.signingOrder ?? DocumentSigningOrder.PARALLEL,
      allowDictateNextSigner: document.documentMeta?.allowDictateNextSigner ?? false,
      language: isValidLanguageCode(document.documentMeta?.language)
        ? document.documentMeta.language
        : undefined,
      signatureTypes: signatureTypes,
      dateFormat: isValidDateFormat(document.documentMeta?.dateFormat)
        ? document.documentMeta?.dateFormat
        : DEFAULT_DOCUMENT_DATE_FORMAT,
      redirectUrl: document.documentMeta?.redirectUrl ?? undefined,
    },
    signers: document.recipients.map((recipient) => ({
      nativeId: recipient.id,
      formId: nanoid(8),
      name: recipient.name,
      email: recipient.email,
      role: recipient.role,
      signingOrder: recipient.signingOrder ?? undefined,
      disabled: recipient.signingStatus !== SigningStatus.NOT_SIGNED,
    })),
  }));

  const [fields, setFields] = useState<TConfigureFieldsFormSchema | null>(() => ({
    fields: document.fields.map((field) => ({
      nativeId: field.id,
      formId: nanoid(8),
      type: field.type,
      signerEmail:
        document.recipients.find((recipient) => recipient.id === field.recipientId)?.email ?? '',
      inserted: field.inserted,
      recipientId: field.recipientId,
      pageNumber: field.page,
      pageX: field.positionX,
      pageY: field.positionY,
      pageWidth: field.width,
      pageHeight: field.height,
      fieldMeta: field.fieldMeta ?? undefined,
    })),
  }));

  const [features, setFeatures] = useState<TBaseEmbedAuthoringSchema['features'] | null>(null);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [canGoBack, setCanGoBack] = useState(true);

  const { mutateAsync: updateEmbeddingDocument } =
    trpc.embeddingPresign.updateEmbeddingDocument.useMutation();

  const handleConfigurePageViewSubmit = (data: TConfigureEmbedFormSchema) => {
    // Store the configuration data and move to the field placement stage
    setConfiguration(data);
    setFields((fieldData) => {
      if (!fieldData) {
        return fieldData;
      }

      const signerEmails = data.signers.map((signer) => signer.email);

      return {
        fields: fieldData.fields.filter((field) => signerEmails.includes(field.signerEmail)),
      };
    });

    setCurrentStep(2);
  };

  const handleBackToConfig = (data: TConfigureFieldsFormSchema) => {
    // Return to the configuration view but keep the data
    setFields(data);
    setCurrentStep(1);
  };

  const handleConfigureFieldsSubmit = async (data: TConfigureFieldsFormSchema) => {
    try {
      if (!configuration) {
        toast({
          variant: 'destructive',
          title: _(msg`Error`),
          description: _(msg`Please configure the document first`),
        });

        return;
      }

      const fields = data.fields;

      // Use the externalId from the URL fragment if available
      const documentExternalId = externalId || configuration.meta.externalId;

      const updateResult = await updateEmbeddingDocument({
        documentId: document.id,
        title: configuration.title,
        externalId: documentExternalId,
        meta: {
          ...configuration.meta,
          drawSignatureEnabled: configuration.meta.signatureTypes
            ? configuration.meta.signatureTypes.length === 0 ||
              configuration.meta.signatureTypes.includes(DocumentSignatureType.DRAW)
            : undefined,
          typedSignatureEnabled: configuration.meta.signatureTypes
            ? configuration.meta.signatureTypes.length === 0 ||
              configuration.meta.signatureTypes.includes(DocumentSignatureType.TYPE)
            : undefined,
          uploadSignatureEnabled: configuration.meta.signatureTypes
            ? configuration.meta.signatureTypes.length === 0 ||
              configuration.meta.signatureTypes.includes(DocumentSignatureType.UPLOAD)
            : undefined,
        },
        recipients: configuration.signers.map((signer) => ({
          id: signer.nativeId,
          name: signer.name,
          email: signer.email,
          role: signer.role,
          signingOrder: signer.signingOrder,
          fields: fields
            .filter((field) => field.signerEmail === signer.email)
            // There's a gnarly discriminated union that makes this hard to satisfy, we're casting for the second
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map<any>((f) => ({
              ...f,
              id: f.nativeId,
              envelopeItemId: document.documentData.envelopeItemId,
              pageX: f.pageX,
              pageY: f.pageY,
              width: f.pageWidth,
              height: f.pageHeight,
            })),
        })),
      });

      toast({
        title: _(msg`Success`),
        description: _(msg`Document updated successfully`),
      });

      // Send a message to the parent window with the document details
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'document-updated',
            documentId: updateResult.documentId,
            externalId: documentExternalId,
          },
          '*',
        );
      }
    } catch (err) {
      console.error('Error updating document:', err);

      toast({
        variant: 'destructive',
        title: _(msg`Error`),
        description: _(msg`Failed to update document`),
      });
    }
  };

  useLayoutEffect(() => {
    try {
      const hash = window.location.hash.slice(1);

      const result = ZBaseEmbedAuthoringEditSchema.safeParse(
        JSON.parse(decodeURIComponent(atob(hash))),
      );

      if (!result.success) {
        return;
      }

      setFeatures(result.data.features);

      if (result.data.onlyEditFields) {
        setCurrentStep(2);
        setCanGoBack(false);
      }

      // Extract externalId from the parsed data if available
      if (result.data.externalId) {
        setExternalId(result.data.externalId);
      }

      setHasFinishedInit(true);
    } catch (err) {
      console.error('Error parsing embedding params:', err);
    }
  }, []);

  if (!hasFinishedInit) {
    return null;
  }

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-screen-lg p-6">
      <ConfigureDocumentProvider isTemplate={false} features={features ?? {}}>
        <Stepper currentStep={currentStep} setCurrentStep={setCurrentStep}>
          <ConfigureDocumentView
            defaultValues={configuration ?? undefined}
            disableUpload={true}
            onSubmit={handleConfigurePageViewSubmit}
          />

          <ConfigureFieldsView
            configData={configuration!}
            presignToken={token}
            envelopeItem={document.envelopeItems[0]}
            defaultValues={fields ?? undefined}
            onBack={canGoBack ? handleBackToConfig : undefined}
            onSubmit={handleConfigureFieldsSubmit}
          />
        </Stepper>
      </ConfigureDocumentProvider>
    </div>
  );
}
