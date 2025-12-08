import { useLayoutEffect, useState } from 'react';

import { useLingui } from '@lingui/react';
import { useNavigate } from 'react-router';

import { putPdfFile } from '@documenso/lib/universal/upload/put-file';
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
  ZBaseEmbedAuthoringSchema,
} from '~/types/embed-authoring-base-schema';

export default function EmbeddingAuthoringTemplateCreatePage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [configuration, setConfiguration] = useState<TConfigureEmbedFormSchema | null>(null);
  const [fields, setFields] = useState<TConfigureFieldsFormSchema | null>(null);
  const [features, setFeatures] = useState<TBaseEmbedAuthoringSchema['features'] | null>(null);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const { mutateAsync: createEmbeddingTemplate } =
    trpc.embeddingPresign.createEmbeddingTemplate.useMutation();

  const handleConfigurePageViewSubmit = (data: TConfigureEmbedFormSchema) => {
    // Store the configuration data and move to the field placement stage
    setConfiguration(data);
    setCurrentStep(2);
  };

  const handleBackToConfig = (data: TConfigureFieldsFormSchema) => {
    // Return to the configuration view but keep the data
    setFields(data);
    setCurrentStep(1);
  };

  const handleConfigureFieldsSubmit = async (data: TConfigureFieldsFormSchema) => {
    try {
      if (!configuration || !configuration.documentData) {
        toast({
          variant: 'destructive',
          title: _('Error'),
          description: _('Please configure the template first'),
        });

        return;
      }

      const fields = data.fields;

      const documentData = await putPdfFile({
        arrayBuffer: async () => Promise.resolve(configuration.documentData!.data.buffer),
        name: configuration.documentData.name,
        type: configuration.documentData.type,
      });

      // Use the externalId from the URL fragment if available
      const metaWithExternalId = {
        ...configuration.meta,
        externalId: externalId || configuration.meta.externalId,
      };

      const createResult = await createEmbeddingTemplate({
        title: configuration.title,
        documentDataId: documentData.id,
        meta: metaWithExternalId,
        recipients: configuration.signers.map((signer) => ({
          name: signer.name,
          email: signer.email,
          role: signer.role,
          fields: fields
            .filter((field) => field.signerEmail === signer.email)
            // There's a gnarly discriminated union that makes this hard to satisfy, we're casting for the second
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map<any>((field) => ({
              ...field,
              pageX: field.pageX,
              pageY: field.pageY,
              width: field.pageWidth,
              height: field.pageHeight,
            })),
        })),
      });

      toast({
        title: _('Success'),
        description: _('Template created successfully'),
      });

      // Send a message to the parent window with the template details
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'template-created',
            templateId: createResult.templateId,
            externalId: metaWithExternalId.externalId,
          },
          '*',
        );
      }

      const hash = window.location.hash.slice(1);

      // Navigate to the completion page instead of the template details page
      await navigate(
        `/embed/v1/authoring/completed/create?templateId=${createResult.templateId}&externalId=${metaWithExternalId.externalId}#${hash}`,
      );
    } catch (err) {
      console.error('Error creating template:', err);

      toast({
        variant: 'destructive',
        title: _('Error'),
        description: _('Failed to create template'),
      });
    }
  };

  useLayoutEffect(() => {
    try {
      const hash = window.location.hash.slice(1);

      const result = ZBaseEmbedAuthoringSchema.safeParse(
        JSON.parse(decodeURIComponent(atob(hash))),
      );

      if (!result.success) {
        return;
      }

      setFeatures(result.data.features);

      // Extract externalId from the parsed data if available
      if (result.data.externalId) {
        setExternalId(result.data.externalId);
      }
    } catch (err) {
      console.error('Error parsing embedding params:', err);
    }
  }, []);

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-screen-lg p-6">
      <ConfigureDocumentProvider isTemplate={true} features={features ?? {}}>
        <Stepper currentStep={currentStep} setCurrentStep={setCurrentStep}>
          <ConfigureDocumentView
            type="template"
            defaultValues={configuration ?? undefined}
            onSubmit={handleConfigurePageViewSubmit}
          />

          <ConfigureFieldsView
            configData={configuration!}
            defaultValues={fields ?? undefined}
            onBack={handleBackToConfig}
            onSubmit={handleConfigureFieldsSubmit}
          />
        </Stepper>
      </ConfigureDocumentProvider>
    </div>
  );
}
