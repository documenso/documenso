import { SUPPORT_EMAIL } from '@documenso/lib/constants/app';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import { TemplateFooter } from '../template-components/template-footer';

export type OrganisationLimitsUpdatedEmailProps = {
  assetBaseUrl: string;
  organisationName: string;
};

export const OrganisationLimitsUpdatedEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  organisationName = 'Organisation Name',
}: OrganisationLimitsUpdatedEmailProps) => {
  const { _ } = useLingui();

  return (
    <Html>
      <Head />
      <Body className="mx-auto my-auto font-sans">
        <Preview>{_(ORGANISATION_LIMITS_UPDATED_SUBJECT)}</Preview>

        <Section className="bg-background text-muted-foreground">
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-2 backdrop-blur-sm">
            <TemplateBrandingLogo assetBaseUrl={assetBaseUrl} className="mb-4 h-6 p-2" />

            <Section className="p-2 text-muted-foreground">
              <Text className="text-center font-medium text-foreground text-lg">
                {_(ORGANISATION_LIMITS_UPDATED_SUBJECT)}
              </Text>

              <div className="mx-auto my-2 w-fit rounded-lg bg-muted px-4 py-2 font-medium text-base text-muted-foreground">
                {organisationName}
              </div>

              <Text className="text-center text-base">
                <Trans>We've updated the usage limits for your organisation.</Trans>
              </Text>

              <Text className="text-center text-base">
                <Trans>
                  If you recently received an email regarding your usage limits, this change was made in response to
                  that.
                </Trans>
              </Text>

              <Text className="text-center text-base">
                <Trans>If you have any questions, please contact support at {SUPPORT_EMAIL}.</Trans>
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

export const ORGANISATION_LIMITS_UPDATED_SUBJECT = msg`Your organisation limits have been updated`;

export default OrganisationLimitsUpdatedEmailTemplate;
