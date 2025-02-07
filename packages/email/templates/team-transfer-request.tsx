import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { formatTeamUrl } from '@documenso/lib/utils/teams';

import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type TeamTransferRequestTemplateProps = {
  assetBaseUrl: string;
  baseUrl: string;
  senderName: string;
  teamName: string;
  teamUrl: string;
  token: string;
};

export const TeamTransferRequestTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  senderName = 'John Doe',
  teamName = 'Team Name',
  teamUrl = 'demo',
  token = '',
}: TeamTransferRequestTemplateProps) => {
  const { _ } = useLingui();

  const previewText = msg`Accept team transfer request on Documenso`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="mx-auto my-auto font-sans">
        <Section className="bg-white text-slate-500">
          <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 px-2 pt-2 backdrop-blur-sm">
            <TemplateImage
              assetBaseUrl={assetBaseUrl}
              className="mb-4 h-6 p-2"
              staticAsset="logo.png"
            />

            <Section>
              <TemplateImage
                className="mx-auto"
                assetBaseUrl={assetBaseUrl}
                staticAsset="add-user.png"
              />
            </Section>

            <Section className="p-2 text-slate-500">
              <Text className="text-center text-lg font-medium text-black">
                <Trans>{teamName} ownership transfer request</Trans>
              </Text>

              <Text className="my-1 text-center text-base">
                <Trans>
                  <span className="font-bold">{senderName}</span> has requested that you take
                  ownership of the following team
                </Trans>
              </Text>

              <div className="mx-auto my-2 w-fit rounded-lg bg-gray-50 px-4 py-2 text-base font-medium text-slate-600">
                {formatTeamUrl(teamUrl, baseUrl)}
              </div>

              <Text className="text-center text-sm">
                <Trans>
                  By accepting this request, you will take responsibility for any billing items
                  associated with this team.
                </Trans>
              </Text>

              <Section className="mb-6 mt-6 text-center">
                <Button
                  className="bg-documenso-500 ml-2 inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-black no-underline"
                  href={`${baseUrl}/team/verify/transfer/${token}`}
                >
                  <Trans>Accept</Trans>
                </Button>
              </Section>
            </Section>

            <Text className="text-center text-xs">
              <Trans>Link expires in 1 hour.</Trans>
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

export default TeamTransferRequestTemplate;
