'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { isValidLanguageCode } from '@documenso/lib/constants/i18n';
import {
  DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  SKIP_QUERY_BATCH_META,
} from '@documenso/lib/constants/trpc';
import type { TemplateWithDetails } from '@documenso/prisma/types/template';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { DocumentFlowFormContainer } from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { AddTemplateFieldsFormPartial } from '@documenso/ui/primitives/template-flow/add-template-fields';
import type { TAddTemplateFieldsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-fields.types';
import { AddTemplatePlaceholderRecipientsFormPartial } from '@documenso/ui/primitives/template-flow/add-template-placeholder-recipients';
import type { TAddTemplatePlacholderRecipientsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-placeholder-recipients.types';
import { AddTemplateSettingsFormPartial } from '@documenso/ui/primitives/template-flow/add-template-settings';
import type { TAddTemplateSettingsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-settings.types';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useOptionalCurrentTeam } from '~/providers/team';

export type EditTemplateFormProps = {
  className?: string;
  initialTemplate: TemplateWithDetails;
  isEnterprise: boolean;
  templateRootPath: string;
};

type EditTemplateStep = 'settings' | 'signers' | 'fields';
const EditTemplateSteps: EditTemplateStep[] = ['settings', 'signers', 'fields'];

export const EditTemplateForm = ({
  initialTemplate,
  className,
  isEnterprise,
  templateRootPath,
}: EditTemplateFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const router = useRouter();

  const team = useOptionalCurrentTeam();

  const [step, setStep] = useState<EditTemplateStep>('settings');

  const [isDocumentPdfLoaded, setIsDocumentPdfLoaded] = useState(false);

  const utils = trpc.useUtils();

  const { data: template, refetch: refetchTemplate } =
    trpc.template.getTemplateWithDetailsById.useQuery(
      {
        id: initialTemplate.id,
      },
      {
        initialData: initialTemplate,
        ...SKIP_QUERY_BATCH_META,
      },
    );

  const { Recipient: recipients, Field: fields, templateDocumentData } = template;

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

  const { mutateAsync: updateTemplateSettings } = trpc.template.updateTemplateSettings.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.template.getTemplateWithDetailsById.setData(
        {
          id: initialTemplate.id,
        },
        (oldData) => ({ ...(oldData || initialTemplate), ...newData }),
      );
    },
  });

  const { mutateAsync: setSigningOrderForTemplate } =
    trpc.template.setSigningOrderForTemplate.useMutation({
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
      onSuccess: (newData) => {
        utils.template.getTemplateWithDetailsById.setData(
          {
            id: initialTemplate.id,
          },
          (oldData) => ({ ...(oldData || initialTemplate), ...newData }),
        );
      },
    });

  const { mutateAsync: addTemplateFields } = trpc.field.addTemplateFields.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.template.getTemplateWithDetailsById.setData(
        {
          id: initialTemplate.id,
        },
        (oldData) => ({ ...(oldData || initialTemplate), ...newData }),
      );
    },
  });

  const { mutateAsync: addTemplateSigners } = trpc.recipient.addTemplateSigners.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.template.getTemplateWithDetailsById.setData(
        {
          id: initialTemplate.id,
        },
        (oldData) => ({ ...(oldData || initialTemplate), ...newData }),
      );
    },
  });

  const onAddSettingsFormSubmit = async (data: TAddTemplateSettingsFormSchema) => {
    try {
      await updateTemplateSettings({
        templateId: template.id,
        teamId: team?.id,
        data: {
          title: data.title,
          externalId: data.externalId || null,
          globalAccessAuth: data.globalAccessAuth ?? null,
          globalActionAuth: data.globalActionAuth ?? null,
        },
        meta: {
          ...data.meta,
          language: isValidLanguageCode(data.meta.language) ? data.meta.language : undefined,
        },
      });

      // Router refresh is here to clear the router cache for when navigating to /documents.
      router.refresh();

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
        setSigningOrderForTemplate({
          templateId: template.id,
          teamId: team?.id,
          signingOrder: data.signingOrder,
        }),

        addTemplateSigners({
          templateId: template.id,
          teamId: team?.id,
          signers: data.signers,
        }),
      ]);

      // Router refresh is here to clear the router cache for when navigating to /documents.
      router.refresh();

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

      // Router refresh is here to clear the router cache for when navigating to /documents.
      router.refresh();

      router.push(templateRootPath);
    } catch (err) {
      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while adding signers.`),
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
          <LazyPDFViewer
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
              documentFlow={documentFlow.settings}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddSettingsFormSubmit}
              isEnterprise={isEnterprise}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
            />

            <AddTemplatePlaceholderRecipientsFormPartial
              key={recipients.length}
              documentFlow={documentFlow.signers}
              recipients={recipients}
              fields={fields}
              signingOrder={template.templateMeta?.signingOrder}
              templateDirectLink={template.directLink}
              onSubmit={onAddTemplatePlaceholderFormSubmit}
              isEnterprise={isEnterprise}
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
