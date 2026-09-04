import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DateTime } from 'luxon';

import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type SignupInviteEmailProps = {
  assetBaseUrl: string;
  baseUrl: string;
  email: string;
  token: string;
  expiresAt: Date;
};

export const SignupInviteEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  email = 'user@example.com',
  token = '',
  expiresAt = new Date(),
}: SignupInviteEmailProps) => {
  const { _, i18n } = useLingui();

  const previewText = msg`You've been invited to create a Documenso account`;
  const formattedExpiresAt = i18n.date(expiresAt, {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const relativeExpiresAt = DateTime.fromJSDate(expiresAt).toRelative() ?? formattedExpiresAt;

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
                <Trans>Create your Documenso account</Trans>
              </Text>

              <Text className="my-1 text-center text-base">
                <Trans>You have been invited to create an account for</Trans>
              </Text>

              <div className="mx-auto my-2 w-fit rounded-lg bg-muted px-4 py-2 font-medium text-base text-muted-foreground">
                {email}
              </div>

              <Text className="my-2 text-center text-base">
                <Trans>
                  This invitation expires on <span className="text-foreground">{formattedExpiresAt}</span> (
                  {relativeExpiresAt}).
                </Trans>
              </Text>

              <Section className="mt-6 mb-6 text-center">
                <Button
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-center font-medium text-primary-foreground text-sm no-underline"
                  href={`${baseUrl}/signup-invite/${token}`}
                >
                  <Trans>Create account</Trans>
                </Button>
              </Section>
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

export default SignupInviteEmailTemplate;
