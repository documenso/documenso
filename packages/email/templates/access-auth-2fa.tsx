import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Img, Preview, Section } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateAccessAuth2FA } from '../template-components/template-access-auth-2fa';
import { TemplateFooter } from '../template-components/template-footer';

export type AccessAuth2FAEmailTemplateProps = {
  documentTitle: string;
  code: string;
  userEmail: string;
  userName: string;
  expiresInMinutes: number;
  assetBaseUrl?: string;
};

export const AccessAuth2FAEmailTemplate = ({
  documentTitle,
  code,
  userEmail,
  userName,
  expiresInMinutes,
  assetBaseUrl = 'http://localhost:3002',
}: AccessAuth2FAEmailTemplateProps) => {
  const { _ } = useLingui();

  const branding = useBranding();

  const previewText = msg`Your verification code is ${code}`;

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

              <TemplateAccessAuth2FA
                documentTitle={documentTitle}
                code={code}
                userEmail={userEmail}
                userName={userName}
                expiresInMinutes={expiresInMinutes}
                assetBaseUrl={assetBaseUrl}
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

export default AccessAuth2FAEmailTemplate;
