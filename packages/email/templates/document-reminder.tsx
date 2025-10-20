import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { RecipientRole } from '@prisma/client';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';

import { Body, Container, Head, Hr, Html, Img, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateDocumentReminder } from '../template-components/template-document-reminder';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentReminderEmailTemplateProps = {
  recipientName: string;
  documentName: string;
  signDocumentLink: string;
  assetBaseUrl?: string;
  customBody?: string;
  role: RecipientRole;
};

export const DocumentReminderEmailTemplate = ({
  recipientName,
  documentName = 'Open Source Pledge.pdf',
  signDocumentLink = 'https://documenso.com',
  assetBaseUrl = 'http://localhost:3002',
  customBody,
  role,
}: DocumentReminderEmailTemplateProps) => {
  const { i18n } = useLingui();
  const branding = useBranding();

  const action = i18n.t(RECIPIENT_ROLES_DESCRIPTION[role].actionVerb).toLowerCase();

  const previewTextString = i18n._(msg`Reminder to ${action} ${documentName}`);

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{previewTextString}</Preview>

      <Body className="mx-auto my-auto bg-white font-sans">
        <Section>
          <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-4 backdrop-blur-sm">
            <Section>
              {branding.brandingEnabled && branding.brandingLogo ? (
                <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6" />
              ) : (
                <Img
                  src={getAssetUrl('/static/logo.png')}
                  alt="Documenso Logo"
                  className="mb-4 h-6"
                />
              )}

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
                <Text className="mt-2 text-base text-slate-400">
                  <pre className="font-sans text-base text-slate-400">{customBody}</pre>
                </Text>
              </Section>
            </Container>
          )}

          <Hr className="mx-auto mt-12 max-w-xl" />

          <Container className="mx-auto max-w-xl">
            <TemplateFooter />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default DocumentReminderEmailTemplate;
