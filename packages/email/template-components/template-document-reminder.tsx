import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { Button, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentReminderProps {
  recipientName: string;
  documentName: string;
  signDocumentLink: string;
  assetBaseUrl: string;
  role: RecipientRole;
}

export const TemplateDocumentReminder = ({
  recipientName,
  documentName,
  signDocumentLink,
  assetBaseUrl,
  role,
}: TemplateDocumentReminderProps) => {
  const { _ } = useLingui();

  const { actionVerb } = RECIPIENT_ROLES_DESCRIPTION[role];

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Text className="mx-auto mb-0 max-w-[80%] text-center font-semibold text-lg text-primary">
          <Trans>
            Reminder: Please {_(actionVerb).toLowerCase()} your document
            <br />"{documentName}"
          </Trans>
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          <Trans>Hi {recipientName},</Trans>
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          {match(role)
            .with(RecipientRole.SIGNER, () => <Trans>Continue by signing the document.</Trans>)
            .with(RecipientRole.VIEWER, () => <Trans>Continue by viewing the document.</Trans>)
            .with(RecipientRole.APPROVER, () => <Trans>Continue by approving the document.</Trans>)
            .with(RecipientRole.CC, () => '')
            .with(RecipientRole.ASSISTANT, () => <Trans>Continue by assisting with the document.</Trans>)
            .exhaustive()}
        </Text>

        <Section className="mt-8 mb-6 text-center">
          <Button
            className="inline-flex items-center justify-center rounded-lg bg-documenso-500 px-6 py-3 text-center font-medium text-black text-sm no-underline"
            href={signDocumentLink}
          >
            {match(role)
              .with(RecipientRole.SIGNER, () => <Trans>Sign Document</Trans>)
              .with(RecipientRole.VIEWER, () => <Trans>View Document</Trans>)
              .with(RecipientRole.APPROVER, () => <Trans>Approve Document</Trans>)
              .with(RecipientRole.CC, () => '')
              .with(RecipientRole.ASSISTANT, () => <Trans>Assist Document</Trans>)
              .exhaustive()}
          </Button>
        </Section>
      </Section>
    </>
  );
};

export default TemplateDocumentReminder;
