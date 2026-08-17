import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { RecipientRole } from '@prisma/client';

import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import { TemplateCustomMessageBody } from '../template-components/template-custom-message-body';
import { TemplateDocumentReminder } from '../template-components/template-document-reminder';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentReminderEmailTemplateProps = {
  recipientName: string;
  documentName: string;
  signDocumentLink: string;
  assetBaseUrl?: string;
  customBody?: string;
  role: RecipientRole;
  reportUrl?: string;
};

export const DocumentReminderEmailTemplate = ({
  recipientName = 'John Doe',
  documentName = 'Open Source Pledge.pdf',
  signDocumentLink = 'https://documenso.com',
  assetBaseUrl = 'http://localhost:3002',
  customBody,
  role = RecipientRole.SIGNER,
  reportUrl,
}: DocumentReminderEmailTemplateProps) => {
  const { _ } = useLingui();

  const action = _(RECIPIENT_ROLES_DESCRIPTION[role].actionVerb).toLowerCase();

  const previewText = msg`Reminder to ${action} ${documentName}`;

  return (
    <Html>
      <Head />

      <Body className="mx-auto my-auto bg-background font-sans">
        <Preview>{_(previewText)}</Preview>

        <Section>
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-4 backdrop-blur-sm">
            <Section>
              <TemplateBrandingLogo assetBaseUrl={assetBaseUrl} className="mb-4 h-6" />

              <TemplateDocumentReminder
                recipientName={recipientName}
                documentName={documentName}
                signDocumentLink={signDocumentLink}
                assetBaseUrl={assetBaseUrl}
                role={role}
              />
            </Section>
          </Container>

          {customBody && (
            <Container className="mx-auto mt-12 max-w-xl">
              <Section>
                <Text className="mt-2 text-base text-muted-foreground">
                  <TemplateCustomMessageBody text={customBody} />
                </Text>
              </Section>
            </Container>
          )}

          <Hr className="mx-auto mt-12 max-w-xl" />

          <Container className="mx-auto max-w-xl">
            <TemplateFooter reportUrl={reportUrl} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default DocumentReminderEmailTemplate;
