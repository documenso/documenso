import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
} from '@react-email/components';

import config from '@documenso/tailwind-config';

import { TemplateFooter } from '../template-components/template-footer';
import {
  TemplateForgotPassword,
  TemplateForgotPasswordProps,
} from '../template-components/template-forgot-password';

export type ForgotPasswordTemplateProps = Partial<TemplateForgotPasswordProps>;

export const ForgotPasswordTemplate = ({
  resetPasswordLink = 'https://documenso.com',
  assetBaseUrl = 'http://localhost:3002',
}: ForgotPasswordTemplateProps) => {
  const previewText = `Password Reset Requested`;

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: config.theme.extend.colors,
            },
          },
        }}
      >
        <Body className="mx-auto my-auto bg-white font-sans">
          <Section>
            <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-4 backdrop-blur-sm">
              <Section>
                <Img
                  src={getAssetUrl('/static/logo.png')}
                  alt="Documenso Logo"
                  className="mb-4 h-6"
                />

                <TemplateForgotPassword
                  resetPasswordLink={resetPasswordLink}
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
      </Tailwind>
    </Html>
  );
};

export default ForgotPasswordTemplate;
