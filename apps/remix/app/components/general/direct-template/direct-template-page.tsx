import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { Field } from '@prisma/client';
import { type Recipient } from '@prisma/client';
import { useNavigate, useSearchParams } from 'react-router';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { TTemplate } from '@documenso/lib/types/template';
import { isRequiredField } from '@documenso/lib/utils/advanced-fields-helpers';
import { trpc } from '@documenso/trpc/react';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { DocumentFlowFormContainer } from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { PDFViewerLazy } from '@documenso/ui/primitives/pdf-viewer/lazy';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentSigningAuthContext } from '~/components/general/document-signing/document-signing-auth-provider';
import { useRequiredDocumentSigningContext } from '~/components/general/document-signing/document-signing-provider';

import {
  DirectTemplateConfigureForm,
  type TDirectTemplateConfigureFormSchema,
} from './direct-template-configure-form';
import {
  type DirectTemplateLocalField,
  DirectTemplateSigningForm,
} from './direct-template-signing-form';

export type DirectTemplatePageViewProps = {
  template: Omit<TTemplate, 'user'>;
  directTemplateToken: string;
  directTemplateRecipient: Recipient & { fields: Field[] };
};

type DirectTemplateStep = 'configure' | 'sign';
const DirectTemplateSteps: DirectTemplateStep[] = ['configure', 'sign'];

export const DirectTemplatePageView = ({
  template,
  directTemplateRecipient,
  directTemplateToken,
}: DirectTemplatePageViewProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { _ } = useLingui();
  const { toast } = useToast();

  const { email, fullName, setEmail } = useRequiredDocumentSigningContext();
  const { recipient, setRecipient } = useRequiredDocumentSigningAuthContext();

  const [step, setStep] = useState<DirectTemplateStep>('configure');
  const [isDocumentPdfLoaded, setIsDocumentPdfLoaded] = useState(false);

  const recipientActionVerb = _(
    RECIPIENT_ROLES_DESCRIPTION[directTemplateRecipient.role].actionVerb,
  );

  const directTemplateFlow: Record<DirectTemplateStep, DocumentFlowStep> = {
    configure: {
      title: msg`General`,
      description: msg`Preview and configure template.`,
      stepIndex: 1,
    },
    sign: {
      title: msg`${recipientActionVerb} document`,
      description: msg`${recipientActionVerb} the document to complete the process.`,
      stepIndex: 2,
    },
  };

  const { mutateAsync: createDocumentFromDirectTemplate } =
    trpc.template.createDocumentFromDirectTemplate.useMutation();

  /**
   * Set the email into a temporary recipient so it can be used for reauth and signing email fields.
   */
  const onConfigureDirectTemplateSubmit = ({ email }: TDirectTemplateConfigureFormSchema) => {
    setEmail(email);

    setRecipient({
      ...recipient,
      email,
    });

    setStep('sign');
  };

  const onSignDirectTemplateSubmit = async (
    fields: DirectTemplateLocalField[],
    nextSigner?: { name: string; email: string },
  ) => {
    try {
      let directTemplateExternalId = searchParams?.get('externalId') || undefined;

      if (directTemplateExternalId) {
        directTemplateExternalId = decodeURIComponent(directTemplateExternalId);
      }

      const { token } = await createDocumentFromDirectTemplate({
        nextSigner,
        directTemplateToken,
        directTemplateExternalId,
        directRecipientName: fullName,
        directRecipientEmail: recipient.email,
        templateUpdatedAt: template.updatedAt,
        signedFieldValues: fields.map((field) => {
          if (isRequiredField(field) && !field.signedValue) {
            throw new Error('Invalid configuration');
          }

          return {
            token: field.signedValue?.token ?? '',
            fieldId: field.signedValue?.fieldId ?? 0,
            value: field.signedValue?.value,
            isBase64: field.signedValue?.isBase64,
            authOptions: field.signedValue?.authOptions,
          };
        }),
      });

      const redirectUrl = template.templateMeta?.redirectUrl;

      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        await navigate(`/sign/${token}/complete`);
      }
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
          <PDFViewerLazy
            key={template.id}
            envelopeItem={template.envelopeItems[0]}
            token={directTemplateRecipient.token}
            version="signed"
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
            <DirectTemplateConfigureForm
              flowStep={directTemplateFlow.configure}
              template={template}
              directTemplateRecipient={directTemplateRecipient}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
              onSubmit={onConfigureDirectTemplateSubmit}
              initialEmail={email}
            />

            <DirectTemplateSigningForm
              flowStep={directTemplateFlow.sign}
              directRecipient={recipient}
              directRecipientFields={directTemplateRecipient.fields}
              template={template}
              onSubmit={onSignDirectTemplateSubmit}
            />
          </Stepper>
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
};
