import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

type OrganisationAccountLinkConfirmationTemplateProps = {
  type: 'create' | 'link';
  confirmationLink: string;
  organisationName: string;
  assetBaseUrl: string;
};

export const OrganisationAccountLinkConfirmationTemplate = ({
  type = 'link',
  confirmationLink = '<CONFIRMATION_LINK>',
  organisationName = '<ORGANISATION_NAME>',
  assetBaseUrl = 'http://localhost:3002',
}: OrganisationAccountLinkConfirmationTemplateProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText =
    type === 'create'
      ? msg`A request has been made to create an account for you`
      : msg`A request has been made to link your Documenso account`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>
      <Body className="mx-auto my-auto font-sans">
        <Section className="bg-white">
          <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 px-2 pt-2 backdrop-blur-sm">
            {branding.brandingEnabled && branding.brandingLogo ? (
              <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6 p-2" />
            ) : (
              <TemplateImage
                assetBaseUrl={assetBaseUrl}
                className="mb-4 h-6 p-2"
                staticAsset="logo.png"
              />
            )}

            <Section>
              <TemplateImage
                className="mx-auto h-12 w-12"
                assetBaseUrl={assetBaseUrl}
                staticAsset="building-2.png"
              />
            </Section>

            <Section className="p-2 text-slate-500">
              <Text className="text-center text-lg font-medium text-black">
                {type === 'create' ? (
                  <Trans>Account creation request</Trans>
                ) : (
                  <Trans>Link your Documenso account</Trans>
                )}
              </Text>

              <Text className="text-center text-base">
                {type === 'create' ? (
                  <Trans>
                    <span className="font-bold">{organisationName}</span> has requested to create an
                    account on your behalf.
                  </Trans>
                ) : (
                  <Trans>
                    <span className="font-bold">{organisationName}</span> has requested to link your
                    current Documenso account to their organisation.
                  </Trans>
                )}
              </Text>

              {/* Placeholder text if we want to have the warning in the email as well. */}
              {/* <Section className="mt-6">
                <Text className="my-0 text-sm">
                  <Trans>
                    By accepting this request, you will be granting{' '}
                    <strong>{organisationName}</strong> full access to:
                  </Trans>
                </Text>

                <ul className="mb-0 mt-2">
                  <li className="text-sm">
                    <Trans>Your account, and everything associated with it</Trans>
                  </li>
                  <li className="mt-1 text-sm">
                    <Trans>Something something something</Trans>
                  </li>
                  <li className="mt-1 text-sm">
                    <Trans>Something something something</Trans>
                  </li>
                </ul>

                <Text className="mt-2 text-sm">
                  <Trans>
                    You can unlink your account at any time in your security settings on Documenso{' '}
                    <Link href={`${assetBaseUrl}/settings/security/linked-accounts`}>here.</Link>
                  </Trans>
                </Text>
              </Section> */}

              <Section className="mb-6 mt-8 text-center">
                <Button
                  className="bg-documenso-500 inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-black no-underline"
                  href={confirmationLink}
                >
                  <Trans>Review request</Trans>
                </Button>
              </Section>
            </Section>

            <Text className="text-center text-xs text-slate-500">
              <Trans>Link expires in 30 minutes.</Trans>
            </Text>
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

export default OrganisationAccountLinkConfirmationTemplate;
