'use client';

import { useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { RECIPIENT_ROLES_DESCRIPTION_ENG } from '@documenso/lib/constants/recipient-roles';
import type { Field } from '@documenso/prisma/client';
import { type Recipient } from '@documenso/prisma/client';
import type { TemplateWithDetails } from '@documenso/prisma/types/template';
import { trpc } from '@documenso/trpc/react';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { DocumentFlowFormContainer } from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from '~/app/(signing)/sign/[token]/document-auth-provider';
import { useRequiredSigningContext } from '~/app/(signing)/sign/[token]/provider';

import type { TConfigureDirectTemplateFormSchema } from './configure-direct-template';
import { ConfigureDirectTemplateFormPartial } from './configure-direct-template';
import type { DirectTemplateLocalField } from './sign-direct-template';
import { SignDirectTemplateForm } from './sign-direct-template';

export type TemplatesDirectPageViewProps = {
  template: TemplateWithDetails;
  directTemplateToken: string;
  directTemplateRecipient: Recipient & { Field: Field[] };
};

type DirectTemplateStep = 'configure' | 'sign';
const DirectTemplateSteps: DirectTemplateStep[] = ['configure', 'sign'];

export const DirectTemplatePageView = ({
  template,
  directTemplateRecipient,
  directTemplateToken,
}: TemplatesDirectPageViewProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { _ } = useLingui();
  const { toast } = useToast();

  const { email, fullName, setEmail } = useRequiredSigningContext();
  const { recipient, setRecipient } = useRequiredDocumentAuthContext();

  const [step, setStep] = useState<DirectTemplateStep>('configure');
  const [isDocumentPdfLoaded, setIsDocumentPdfLoaded] = useState(false);

  const recipientRoleDescription = RECIPIENT_ROLES_DESCRIPTION_ENG[directTemplateRecipient.role];

  const directTemplateFlow: Record<DirectTemplateStep, DocumentFlowStep> = {
    configure: {
      title: msg`General`,
      description: msg`Preview and configure template.`,
      stepIndex: 1,
    },
    sign: {
      // Todo: Translations
      title: msg`${recipientRoleDescription.actionVerb} document`,
      description: msg`${recipientRoleDescription.actionVerb} the document to complete the process.`,
      stepIndex: 2,
    },
  };

  const { mutateAsync: createDocumentFromDirectTemplate } =
    trpc.template.createDocumentFromDirectTemplate.useMutation();

  /**
   * Set the email into a temporary recipient so it can be used for reauth and signing email fields.
   */
  const onConfigureDirectTemplateSubmit = ({ email }: TConfigureDirectTemplateFormSchema) => {
    setEmail(email);

    setRecipient({
      ...recipient,
      email,
    });

    setStep('sign');
  };

  const onSignDirectTemplateSubmit = async (fields: DirectTemplateLocalField[]) => {
    try {
      let directTemplateExternalId = searchParams?.get('externalId') || undefined;

      if (directTemplateExternalId) {
        directTemplateExternalId = decodeURIComponent(directTemplateExternalId);
      }

      const { token } = await createDocumentFromDirectTemplate({
        directTemplateToken,
        directTemplateExternalId,
        directRecipientName: fullName,
        directRecipientEmail: recipient.email,
        templateUpdatedAt: template.updatedAt,
        signedFieldValues: fields.map((field) => {
          if (!field.signedValue) {
            throw new Error('Invalid configuration');
          }

          return field.signedValue;
        }),
      });

      const redirectUrl = template.templateMeta?.redirectUrl;

      redirectUrl ? router.push(redirectUrl) : router.push(`/sign/${token}/complete`);
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`We were unable to submit this document at this time. Please try again later.`,
        ),
        variant: 'destructive',
      });

      throw err;
    }
  };

  const currentDocumentFlow = directTemplateFlow[step];

  return (
    <div className="grid w-full grid-cols-12 gap-8">
      <Card
        className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
        gradient
      >
        <CardContent className="p-2">
          <LazyPDFViewer
            key={template.id}
            documentData={template.templateDocumentData}
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
            setCurrentStep={(step) => setStep(DirectTemplateSteps[step - 1])}
          >
            <ConfigureDirectTemplateFormPartial
              flowStep={directTemplateFlow.configure}
              template={template}
              directTemplateRecipient={directTemplateRecipient}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
              onSubmit={onConfigureDirectTemplateSubmit}
              initialEmail={email}
            />

            <SignDirectTemplateForm
              flowStep={directTemplateFlow.sign}
              directRecipient={recipient}
              directRecipientFields={directTemplateRecipient.Field}
              template={template}
              onSubmit={onSignDirectTemplateSubmit}
            />
          </Stepper>
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
};
