import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Img, Preview, Section } from '../components';
import { useBranding } from '../providers/branding';
import type { TemplateAdminUserWelcomeProps } from '../template-components/template-admin-user-welcome';
import { TemplateAdminUserWelcome } from '../template-components/template-admin-user-welcome';
import { TemplateFooter } from '../template-components/template-footer';

export const AdminUserWelcomeTemplate = ({
  resetPasswordLink,
  assetBaseUrl = 'http://localhost:3002',
  organisationName,
}: TemplateAdminUserWelcomeProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = msg`Set your password for ${organisationName}`;

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>
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

              <TemplateAdminUserWelcome
                resetPasswordLink={resetPasswordLink}
                assetBaseUrl={assetBaseUrl}
                organisationName={organisationName}
              />
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

export default AdminUserWelcomeTemplate;
