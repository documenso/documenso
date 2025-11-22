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
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
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

  const templateId = Number(id);

  if (!templateId || Number.isNaN(templateId)) {
    redirect(`/embed/v1/authoring/error/not-found?templateId=${templateId}`);
  }

  const template = await getTemplateById({
    id: {
      type: 'templateId',
      id: templateId,
    },
    userId: result?.userId,
    teamId: result?.teamId ?? undefined,
  }).catch(() => null);

  if (!template) {
    throw redirect(`/embed/v1/authoring/error/not-found?templateId=${templateId}`);
  }

  const fields = template.fields.map((field) => ({
    ...field,
    positionX: field.positionX.toNumber(),
    positionY: field.positionY.toNumber(),
    width: field.width.toNumber(),
    height: field.height.toNumber(),
  }));

  return {
    token,
    template: {
      ...template,
      fields,
    },
  };
};

export default function EmbeddingAuthoringTemplateEditPage() {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { template, token } = useLoaderData<typeof loader>();

  const [hasFinishedInit, setHasFinishedInit] = useState(false);

  const signatureTypes = useMemo(() => {
    const types: string[] = [];

    if (template.templateMeta?.drawSignatureEnabled) {
      types.push(DocumentSignatureType.DRAW);
    }

    if (template.templateMeta?.typedSignatureEnabled) {
      types.push(DocumentSignatureType.TYPE);
    }

    if (template.templateMeta?.uploadSignatureEnabled) {
      types.push(DocumentSignatureType.UPLOAD);
    }

    return types;
  }, [template.templateMeta]);

  const [configuration, setConfiguration] = useState<TConfigureEmbedFormSchema | null>(() => ({
    title: template.title,
    documentData: undefined,
    meta: {
      subject: template.templateMeta?.subject ?? undefined,
      message: template.templateMeta?.message ?? undefined,
      distributionMethod:
        template.templateMeta?.distributionMethod ?? DocumentDistributionMethod.EMAIL,
      emailSettings: template.templateMeta?.emailSettings ?? ZDocumentEmailSettingsSchema.parse({}),
      timezone: template.templateMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
      signingOrder: template.templateMeta?.signingOrder ?? DocumentSigningOrder.PARALLEL,
      allowDictateNextSigner: template.templateMeta?.allowDictateNextSigner ?? false,
      language: isValidLanguageCode(template.templateMeta?.language)
        ? template.templateMeta.language
        : undefined,
      signatureTypes: signatureTypes,
      dateFormat: isValidDateFormat(template.templateMeta?.dateFormat)
        ? template.templateMeta?.dateFormat
        : DEFAULT_DOCUMENT_DATE_FORMAT,
      redirectUrl: template.templateMeta?.redirectUrl ?? undefined,
    },
    signers: template.recipients.map((recipient) => ({
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
    fields: template.fields.map((field) => ({
      nativeId: field.id,
      formId: nanoid(8),
      type: field.type,
      signerEmail:
        template.recipients.find((recipient) => recipient.id === field.recipientId)?.email ?? '',
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

  const { mutateAsync: updateEmbeddingTemplate } =
    trpc.embeddingPresign.updateEmbeddingTemplate.useMutation();

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
      const templateExternalId = externalId || configuration.meta.externalId;

      const updateResult = await updateEmbeddingTemplate({
        templateId: template.id,
        title: configuration.title,
        externalId: templateExternalId,
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
              envelopeItemId: template.templateDocumentData.envelopeItemId,
              pageX: f.pageX,
              pageY: f.pageY,
              width: f.pageWidth,
              height: f.pageHeight,
            })),
        })),
      });

      toast({
        title: _(msg`Success`),
        description: _(msg`Template updated successfully`),
      });

      // Send a message to the parent window with the template details
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'template-updated',
            templateId: updateResult.templateId,
            externalId: templateExternalId,
          },
          '*',
        );
      }
    } catch (err) {
      console.error('Error updating template:', err);

      toast({
        variant: 'destructive',
        title: _(msg`Error`),
        description: _(msg`Failed to update template`),
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
            type="template"
            defaultValues={configuration ?? undefined}
            disableUpload={true}
            onSubmit={handleConfigurePageViewSubmit}
          />

          <ConfigureFieldsView
            configData={configuration!}
            presignToken={token}
            envelopeItem={template.envelopeItems[0]}
            defaultValues={fields ?? undefined}
            onBack={canGoBack ? handleBackToConfig : undefined}
            onSubmit={handleConfigureFieldsSubmit}
          />
        </Stepper>
      </ConfigureDocumentProvider>
    </div>
  );
}
