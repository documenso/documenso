import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Img, Preview, Section } from '../components';
import type { TemplateAccountDisabledProps } from '../template-components/template-account-disabled';
import { TemplateAccountDisabled } from '../template-components/template-account-disabled';
import { TemplateFooter } from '../template-components/template-footer';
import { getEmailAssetUrl } from '../utils/asset-url';

export type AccountDisabledEmailTemplateProps = Partial<TemplateAccountDisabledProps>;

export const AccountDisabledEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  supportEmail = 'support@documenso.com',
}: AccountDisabledEmailTemplateProps) => {
  const { _ } = useLingui();

  const previewText = msg`Your Documenso account has been disabled`;

  return (
    <Html>
      <Head />
      <Body className="mx-auto my-auto bg-background font-sans">
        <Preview>{_(previewText)}</Preview>

        <Section>
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-4 backdrop-blur-sm">
            <Section>
              <Img src={getEmailAssetUrl(assetBaseUrl, 'static/logo.png')} alt="Documenso Logo" className="mb-4 h-6" />

              <TemplateAccountDisabled assetBaseUrl={assetBaseUrl} supportEmail={supportEmail} />
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

export default AccountDisabledEmailTemplate;
