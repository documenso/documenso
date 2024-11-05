import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { formatTeamUrl } from '@documenso/lib/utils/teams';

import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type TeamEmailRemovedTemplateProps = {
  assetBaseUrl: string;
  baseUrl: string;
  teamEmail: string;
  teamName: string;
  teamUrl: string;
};

export const TeamEmailRemovedTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  teamEmail = 'example@documenso.com',
  teamName = 'Team Name',
  teamUrl = 'demo',
}: TeamEmailRemovedTemplateProps) => {
  const { _ } = useLingui();

  const previewText = msg`Team email removed for ${teamName} on Documenso`;

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
                staticAsset="mail-open-alert.png"
              />
            </Section>

            <Section className="p-2 text-slate-500">
              <Text className="text-center text-lg font-medium text-black">
                <Trans>Team email removed</Trans>
              </Text>

              <Text className="my-1 text-center text-base">
                <Trans>
                  The team email <span className="font-bold">{teamEmail}</span> has been removed
                  from the following team
                </Trans>
              </Text>

              <div className="mx-auto mb-6 mt-2 w-fit rounded-lg bg-gray-50 px-4 py-2 text-base font-medium text-slate-600">
                {formatTeamUrl(teamUrl, baseUrl)}
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

export default TeamEmailRemovedTemplate;
