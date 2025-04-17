import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { RecipientRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';

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
        {/* Reminder specific text */}
        <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
          <Trans>
            Reminder: Please {_(actionVerb).toLowerCase()} your document
            <br />"{documentName}"
          </Trans>
        </Text>

        {/* Addressee */}
        <Text className="my-1 text-center text-base text-slate-400">
          <Trans>Hi {recipientName},</Trans>
        </Text>

        {/* Reminder Call to Action */}
        <Text className="my-1 text-center text-base text-slate-400">
          {match(role)
            .with('SIGNER', () => <Trans>Continue by signing the document.</Trans>)
            .with('VIEWER', () => <Trans>Continue by viewing the document.</Trans>)
            .with('APPROVER', () => <Trans>Continue by approving the document.</Trans>)
            .with('CC', () => '')
            .with('ASSISTANT', () => <Trans>Continue by assisting with the document.</Trans>)
            .exhaustive()}
        </Text>

        {/* Primary Action Button */}
        <Section className="mb-6 mt-8 text-center">
          <Button
            className="bg-documenso-500 inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-black no-underline"
            href={signDocumentLink}
          >
            {match(role)
              .with('SIGNER', () => <Trans>Sign Document</Trans>)
              .with('VIEWER', () => <Trans>View Document</Trans>)
              .with('APPROVER', () => <Trans>Approve Document</Trans>)
              .with('CC', () => '')
              .with('ASSISTANT', () => <Trans>Assist Document</Trans>)
              .exhaustive()}
          </Button>
        </Section>
      </Section>
    </>
  );
};

export default TemplateDocumentReminder;
