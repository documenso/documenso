import { SUPPORT_EMAIL } from '@documenso/lib/constants/app';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { match } from 'ts-pattern';
import { Body, Container, Head, Hr, Html, Img, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type OrganisationLimitExceededEmailProps = {
  assetBaseUrl: string;
  organisationName: string;
  counter: 'document' | 'email' | 'api';
  kind: 'rateLimit' | 'quota';
  period: string;
};

export const OrganisationLimitExceededEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  organisationName = 'Organisation Name',
  counter = 'email',
  kind = 'quota',
  period = '2026-05',
}: OrganisationLimitExceededEmailProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = msg`Your organisation has been flagged`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="mx-auto my-auto font-sans">
        <Section className="bg-white text-slate-500">
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-slate-200 border-solid p-2 backdrop-blur-sm">
            {branding.brandingEnabled && branding.brandingLogo ? (
              <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6 p-2" />
            ) : (
              <TemplateImage assetBaseUrl={assetBaseUrl} className="mb-4 h-6 p-2" staticAsset="logo.png" />
            )}

            <Section className="p-2 text-slate-500">
              <Text className="text-center font-medium text-black text-lg">
                <Trans>Account flagged for {organisationName}</Trans>
              </Text>

              {kind === 'quota' ? (
                <Text className="text-center text-base">
                  {match(counter)
                    .with('document', () => (
                      <Trans>
                        Due to excessive document activity, your account has been flagged. New document activity is
                        temporarily disabled.
                      </Trans>
                    ))
                    .with('email', () => (
                      <Trans>
                        Due to excessive email activity, your account has been flagged. New email activity is
                        temporarily disabled.
                      </Trans>
                    ))
                    .with('api', () => (
                      <Trans>
                        Due to excessive API activity, your account has been flagged. New API activity is temporarily
                        disabled.
                      </Trans>
                    ))
                    .exhaustive()}
                </Text>
              ) : (
                <Text className="text-center text-base">
                  {match(counter)
                    .with('document', () => (
                      <Trans>
                        Your organisation is generating documents faster than normal, so some requests are being
                        temporarily throttled.
                      </Trans>
                    ))
                    .with('email', () => (
                      <Trans>
                        Your organisation is generating emails faster than normal, so some requests are being
                        temporarily throttled.
                      </Trans>
                    ))
                    .with('api', () => (
                      <Trans>
                        Your organisation is generating API requests faster than normal, so some requests are being
                        temporarily throttled.
                      </Trans>
                    ))
                    .exhaustive()}
                </Text>
              )}

              <Text className="text-center text-base">
                <Trans>Please contact support at {SUPPORT_EMAIL} and we will review your account.</Trans>
              </Text>
            </Section>
          </Container>

          <Hr className="mx-auto mt-12 max-w-xl" />

          <Container className="mx-auto max-w-xl">
            <TemplateFooter isDocument={false} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default OrganisationLimitExceededEmailTemplate;
