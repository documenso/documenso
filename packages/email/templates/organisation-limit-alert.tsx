import { SUPPORT_EMAIL } from '@documenso/lib/constants/app';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { match } from 'ts-pattern';
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import { TemplateFooter } from '../template-components/template-footer';

export type OrganisationLimitAlertEmailProps = {
  assetBaseUrl: string;
  organisationName: string;
  counter: 'document' | 'email' | 'api';
  kind: 'rateLimit' | 'quota' | 'quotaNearing';
  period: string;
};

export const OrganisationLimitAlertEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  organisationName = 'Organisation Name',
  counter = 'email',
  kind = 'quota',
  period = '2026-05',
}: OrganisationLimitAlertEmailProps) => {
  const { _ } = useLingui();

  const previewText = kind === 'quotaNearing' ? msg`Approaching Your Plan Limits` : msg`Organisation Review Required`;

  return (
    <Html>
      <Head />
      <Body className="mx-auto my-auto font-sans">
        <Preview>{_(previewText)}</Preview>

        <Section className="bg-background text-muted-foreground">
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-2 backdrop-blur-sm">
            <TemplateBrandingLogo assetBaseUrl={assetBaseUrl} className="mb-4 h-6 p-2" />

            <Section className="p-2 text-muted-foreground">
              <Text className="text-center font-medium text-foreground text-lg">
                {kind === 'quotaNearing' ? (
                  <Trans>Approaching Your Plan Limits</Trans>
                ) : (
                  <Trans>Organisation Review Required</Trans>
                )}
              </Text>

              <div className="mx-auto my-2 w-fit rounded-lg bg-muted px-4 py-2 font-medium text-base text-muted-foreground">
                {organisationName}
              </div>

              {match(kind)
                .with('quota', () => (
                  <Text className="text-center text-base">
                    {match(counter)
                      .with('document', () => (
                        <Trans>
                          We've noticed document activity on your account that exceeds the fair use limits of your
                          current plan. As a precaution, new document activity has been temporarily paused pending
                          review.
                        </Trans>
                      ))
                      .with('email', () => (
                        <Trans>
                          We've noticed email sending activity on your account that exceeds the fair use limits of your
                          current plan. As a precaution, new email activity has been temporarily paused pending review.
                        </Trans>
                      ))
                      .with('api', () => (
                        <Trans>
                          We've noticed API activity on your account that exceeds the fair use limits of your current
                          plan. As a precaution, new API activity has been temporarily paused pending review.
                        </Trans>
                      ))
                      .exhaustive()}
                  </Text>
                ))
                .with('rateLimit', () => (
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
                ))
                .with('quotaNearing', () => (
                  <Text className="text-center text-base">
                    {match(counter)
                      .with('document', () => (
                        <Trans>
                          Your organisation is nearing its fair use limits for creating documents on your current plan.
                          Once the limit is reached, new document activity will be temporarily paused.
                        </Trans>
                      ))
                      .with('email', () => (
                        <Trans>
                          Your organisation is nearing its fair use limits for sending email on your current plan. Once
                          the limit is reached, new email activity will be temporarily paused.
                        </Trans>
                      ))
                      .with('api', () => (
                        <Trans>
                          Your organisation is nearing its fair use limits for making API requests on your current plan.
                          Once the limit is reached, new API activity will be temporarily paused.
                        </Trans>
                      ))
                      .exhaustive()}
                  </Text>
                ))
                .exhaustive()}

              <Text className="text-center text-base">
                {kind === 'quotaNearing' ? (
                  <Trans>
                    If you expect to need higher limits, please contact support at {SUPPORT_EMAIL} and we will review
                    your account.
                  </Trans>
                ) : (
                  <Trans>Please contact support at {SUPPORT_EMAIL} and we will review your account.</Trans>
                )}
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

export default OrganisationLimitAlertEmailTemplate;
