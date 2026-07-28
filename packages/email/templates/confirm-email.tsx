import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Preview, Section } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import type { TemplateConfirmationEmailProps } from '../template-components/template-confirmation-email';
import { TemplateConfirmationEmail } from '../template-components/template-confirmation-email';
import { TemplateFooter } from '../template-components/template-footer';

export const ConfirmEmailTemplate = ({
  confirmationLink,
  assetBaseUrl = 'http://localhost:3002',
}: TemplateConfirmationEmailProps) => {
  const { _ } = useLingui();

  const previewText = msg`Please confirm your email address`;

  return (
    <Html>
      <Head />
      <Body className="mx-auto my-auto bg-background font-sans">
        <Preview>{_(previewText)}</Preview>

        <Section>
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-4 backdrop-blur-sm">
            <Section>
              <TemplateBrandingLogo assetBaseUrl={assetBaseUrl} className="mb-4 h-6" />

              <TemplateConfirmationEmail confirmationLink={confirmationLink} assetBaseUrl={assetBaseUrl} />
            </Section>
          </Container>
          <div className="mx-auto mt-12 max-w-xl" />

          <Container className="mx-auto max-w-xl">
            <TemplateFooter isDocument={false} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default ConfirmEmailTemplate;
