import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { formatTeamUrl } from '@documenso/lib/utils/teams';

import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type TeamJoinEmailProps = {
  assetBaseUrl: string;
  baseUrl: string;
  memberName: string;
  memberEmail: string;
  teamName: string;
  teamUrl: string;
};

export const TeamJoinEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  memberName = 'John Doe',
  memberEmail = 'johndoe@documenso.com',
  teamName = 'Team Name',
  teamUrl = 'demo',
}: TeamJoinEmailProps) => {
  const { _ } = useLingui();

  const previewText = msg`A team member has joined a team on Documenso`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="mx-auto my-auto font-sans">
        <Section className="bg-white text-slate-500">
          <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-2 backdrop-blur-sm">
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
                <Trans>
                  {memberName || memberEmail} joined the team {teamName} on Documenso
                </Trans>
              </Text>

              <Text className="my-1 text-center text-base">
                <Trans>{memberEmail} joined the following team</Trans>
              </Text>

              <div className="mx-auto my-2 w-fit rounded-lg bg-gray-50 px-4 py-2 text-base font-medium text-slate-600">
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

export default TeamJoinEmailTemplate;
