import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useNavigate } from 'react-router';

import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { isValidLanguageCode } from '@documenso/lib/constants/i18n';
import {
  DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  SKIP_QUERY_BATCH_META,
} from '@documenso/lib/constants/trpc';
import type { TTemplate } from '@documenso/lib/types/template';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { DocumentFlowFormContainer } from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { PDFViewer } from '@documenso/ui/primitives/pdf-viewer';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { AddTemplateFieldsFormPartial } from '@documenso/ui/primitives/template-flow/add-template-fields';
import type { TAddTemplateFieldsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-fields.types';
import { AddTemplatePlaceholderRecipientsFormPartial } from '@documenso/ui/primitives/template-flow/add-template-placeholder-recipients';
import type { TAddTemplatePlacholderRecipientsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-placeholder-recipients.types';
import { AddTemplateSettingsFormPartial } from '@documenso/ui/primitives/template-flow/add-template-settings';
import type { TAddTemplateSettingsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-settings.types';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

export type TemplateEditFormProps = {
  className?: string;
  initialTemplate: TTemplate;
  templateRootPath: string;
};

type EditTemplateStep = 'settings' | 'signers' | 'fields';
const EditTemplateSteps: EditTemplateStep[] = ['settings', 'signers', 'fields'];

export const TemplateEditForm = ({
  initialTemplate,
  className,
  templateRootPath,
}: TemplateEditFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();
  const team = useCurrentTeam();

  const [step, setStep] = useState<EditTemplateStep>('settings');

  const [isDocumentPdfLoaded, setIsDocumentPdfLoaded] = useState(false);

  const utils = trpc.useUtils();

  const { data: template, refetch: refetchTemplate } = trpc.template.getTemplateById.useQuery(
    {
      templateId: initialTemplate.id,
    },
    {
      initialData: initialTemplate,
      ...SKIP_QUERY_BATCH_META,
    },
  );

  const { recipients, fields, templateDocumentData } = template;

  const documentFlow: Record<EditTemplateStep, DocumentFlowStep> = {
    settings: {
      title: msg`General`,
      description: msg`Configure general settings for the template.`,
      stepIndex: 1,
    },
    signers: {
      title: msg`Add Placeholders`,
      description: msg`Add all relevant placeholders for each recipient.`,
      stepIndex: 2,
    },
    fields: {
      title: msg`Add Fields`,
      description: msg`Add all relevant fields for each recipient.`,
      stepIndex: 3,
    },
  };

  const currentDocumentFlow = documentFlow[step];

  const { mutateAsync: updateTemplateSettings } = trpc.template.updateTemplate.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.template.getTemplateById.setData(
        {
          templateId: initialTemplate.id,
        },
        (oldData) => ({ ...(oldData || initialTemplate), ...newData }),
      );
    },
  });

  const { mutateAsync: addTemplateFields } = trpc.field.addTemplateFields.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.template.getTemplateById.setData(
        {
          templateId: initialTemplate.id,
        },
        (oldData) => ({ ...(oldData || initialTemplate), ...newData }),
      );
    },
  });

  const { mutateAsync: setRecipients } = trpc.recipient.setTemplateRecipients.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.template.getTemplateById.setData(
        {
          templateId: initialTemplate.id,
        },
        (oldData) => ({ ...(oldData || initialTemplate), ...newData }),
      );
    },
  });

  const onAddSettingsFormSubmit = async (data: TAddTemplateSettingsFormSchema) => {
    const { signatureTypes } = data.meta;

    try {
      await updateTemplateSettings({
        templateId: template.id,
        data: {
          title: data.title,
          externalId: data.externalId || null,
          visibility: data.visibility,
          globalAccessAuth: data.globalAccessAuth ?? null,
          globalActionAuth: data.globalActionAuth ?? null,
        },
        meta: {
          ...data.meta,
          typedSignatureEnabled: signatureTypes.includes(DocumentSignatureType.TYPE),
          uploadSignatureEnabled: signatureTypes.includes(DocumentSignatureType.UPLOAD),
          drawSignatureEnabled: signatureTypes.includes(DocumentSignatureType.DRAW),
          language: isValidLanguageCode(data.meta.language) ? data.meta.language : undefined,
        },
      });

      setStep('signers');
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while updating the document settings.`),
        variant: 'destructive',
      });
    }
  };

  const onAddTemplatePlaceholderFormSubmit = async (
    data: TAddTemplatePlacholderRecipientsFormSchema,
  ) => {
    try {
      await Promise.all([
        updateTemplateSettings({
          templateId: template.id,
          meta: {
            signingOrder: data.signingOrder,
            allowDictateNextSigner: data.allowDictateNextSigner,
          },
        }),

        setRecipients({
          templateId: template.id,
          recipients: data.signers,
        }),
      ]);

      setStep('fields');
    } catch (err) {
      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while adding signers.`),
        variant: 'destructive',
      });
    }
  };

  const onAddFieldsFormSubmit = async (data: TAddTemplateFieldsFormSchema) => {
    try {
      await addTemplateFields({
        templateId: template.id,
        fields: data.fields,
      });

      // Clear all field data from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('field_')) {
          localStorage.removeItem(key);
        }
      }

      toast({
        title: _(msg`Template saved`),
        description: _(msg`Your templates has been saved successfully.`),
        duration: 5000,
      });

      const templatePath = template.folderId
        ? `${templateRootPath}/f/${template.folderId}`
        : templateRootPath;

      await navigate(templatePath);
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while adding fields.`),
        variant: 'destructive',
      });
    }
  };

  /**
   * Refresh the data in the background when steps change.
   */
  useEffect(() => {
    void refetchTemplate();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className={cn('grid w-full grid-cols-12 gap-8', className)}>
      <Card
        className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
        gradient
      >
        <CardContent className="p-2">
          <PDFViewer
            key={templateDocumentData.id}
            documentData={templateDocumentData}
            onDocumentLoad={() => setIsDocumentPdfLoaded(true)}
          />
        </CardContent>
      </Card>

      <div className="col-span-12 lg:col-span-6 xl:col-span-5">
        <DocumentFlowFormContainer
          className="lg:h-[calc(100vh-6rem)]"
          onSubmit={(e) => e.preventDefault()}
        >
          <Stepper
            currentStep={currentDocumentFlow.stepIndex}
            setCurrentStep={(step) => setStep(EditTemplateSteps[step - 1])}
          >
            <AddTemplateSettingsFormPartial
              key={recipients.length}
              template={template}
              currentTeamMemberRole={team.currentTeamRole}
              documentFlow={documentFlow.settings}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddSettingsFormSubmit}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
            />

            <AddTemplatePlaceholderRecipientsFormPartial
              key={recipients.length}
              documentFlow={documentFlow.signers}
              recipients={recipients}
              fields={fields}
              signingOrder={template.templateMeta?.signingOrder}
              allowDictateNextSigner={template.templateMeta?.allowDictateNextSigner}
              templateDirectLink={template.directLink}
              onSubmit={onAddTemplatePlaceholderFormSubmit}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
            />

            <AddTemplateFieldsFormPartial
              key={fields.length}
              documentFlow={documentFlow.fields}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddFieldsFormSubmit}
              teamId={team?.id}
            />
          </Stepper>
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
};
