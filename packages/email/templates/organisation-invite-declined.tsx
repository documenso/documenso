import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type OrganisationInviteDeclinedEmailProps = {
  assetBaseUrl: string;
  baseUrl: string;
  inviteeEmail: string;
  organisationName: string;
  organisationUrl: string;
};

export const OrganisationInviteDeclinedEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  inviteeEmail = 'johndoe@documenso.com',
  organisationName = 'Organisation Name',
  organisationUrl = 'demo',
}: OrganisationInviteDeclinedEmailProps) => {
  const { _ } = useLingui();

  const previewText = msg`An organisation invite has been declined on Documenso`;

  return (
    <Html>
      <Head />
      <Body className="mx-auto my-auto font-sans">
        <Preview>{_(previewText)}</Preview>

        <Section className="bg-background text-muted-foreground">
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-2 backdrop-blur-sm">
            <TemplateBrandingLogo assetBaseUrl={assetBaseUrl} className="mb-4 h-6 p-2" />

            <Section>
              <TemplateImage className="mx-auto" assetBaseUrl={assetBaseUrl} staticAsset="add-user.png" />
            </Section>

            <Section className="p-2 text-muted-foreground">
              <Text className="text-center font-medium text-foreground text-lg">
                <Trans>An invite to your organisation {organisationName} has been declined</Trans>
              </Text>

              <Text className="my-1 text-center text-base">
                <Trans>The following user has declined their invitation to join</Trans>
              </Text>

              <div className="mx-auto my-2 w-fit rounded-lg bg-muted px-4 py-2 font-medium text-base text-muted-foreground">
                {inviteeEmail}
              </div>
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

export default OrganisationInviteDeclinedEmailTemplate;
