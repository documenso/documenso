import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { formatTeamUrl } from '@documenso/lib/utils/teams';

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

export type TeamInviteEmailProps = {
  assetBaseUrl: string;
  baseUrl: string;
  senderName: string;
  teamName: string;
  teamUrl: string;
  token: string;
};

export const TeamInviteEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  senderName = 'John Doe',
  teamName = 'Team Name',
  teamUrl = 'demo',
  token = '',
}: TeamInviteEmailProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = msg`Accept invitation to join a team on Documenso`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="mx-auto my-auto font-sans">
        <Section className="bg-white text-slate-500">
          <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-2 backdrop-blur-sm">
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
                className="mx-auto"
                assetBaseUrl={assetBaseUrl}
                staticAsset="add-user.png"
              />
            </Section>

            <Section className="p-2 text-slate-500">
              <Text className="text-center text-lg font-medium text-black">
                <Trans>Join {teamName} on Documenso</Trans>
              </Text>

              <Text className="my-1 text-center text-base">
                <Trans>You have been invited to join the following team</Trans>
              </Text>

              <div className="mx-auto my-2 w-fit rounded-lg bg-gray-50 px-4 py-2 text-base font-medium text-slate-600">
                {formatTeamUrl(teamUrl, baseUrl)}
              </div>

              <Text className="my-1 text-center text-base">
                <Trans>
                  by <span className="text-slate-900">{senderName}</span>
                </Trans>
              </Text>

              <Section className="mb-6 mt-6 text-center">
                <Button
                  className="bg-documenso-500 inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-black no-underline"
                  href={`${baseUrl}/team/invite/${token}`}
                >
                  <Trans>Accept</Trans>
                </Button>
                <Button
                  className="ml-4 inline-flex items-center justify-center rounded-lg bg-gray-50 px-6 py-3 text-center text-sm font-medium text-slate-600 no-underline"
                  href={`${baseUrl}/team/decline/${token}`}
                >
                  <Trans>Decline</Trans>
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

export default TeamInviteEmailTemplate;
