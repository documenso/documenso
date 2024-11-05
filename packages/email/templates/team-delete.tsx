import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { formatTeamUrl } from '@documenso/lib/utils/teams';

import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type TeamDeleteEmailProps = {
  assetBaseUrl: string;
  baseUrl: string;
  teamUrl: string;
  isOwner: boolean;
};

export const TeamDeleteEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  teamUrl = 'demo',
  isOwner = false,
}: TeamDeleteEmailProps) => {
  const { _ } = useLingui();

  const previewText = isOwner
    ? msg`Your team has been deleted`
    : msg`A team you were a part of has been deleted`;

  const title = isOwner
    ? msg`Your team has been deleted`
    : msg`A team you were a part of has been deleted`;

  const description = isOwner
    ? msg`The following team has been deleted by you`
    : msg`The following team has been deleted by its owner. You will no longer be able to access this team and its documents`;

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
                staticAsset="delete-team.png"
              />
            </Section>

            <Section className="p-2 text-slate-500">
              <Text className="text-center text-lg font-medium text-black">{_(title)}</Text>

              <Text className="my-1 text-center text-base">{_(description)}</Text>

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

export default TeamDeleteEmailTemplate;
