import { formatTeamUrl } from '@documenso/lib/utils/teams';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Hr, Html, Img, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type TeamDeleteEmailProps = {
  assetBaseUrl: string;
  baseUrl: string;
  teamUrl: string;
};

export const TeamDeleteEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  teamUrl = 'demo',
}: TeamDeleteEmailProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = msg`A team you were a part of has been deleted`;

  const title = msg`A team you were a part of has been deleted`;

  const description = msg`The following team has been deleted. You will no longer be able to access this team and its documents`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="mx-auto my-auto font-sans">
        <Section className="bg-white text-slate-500">
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-slate-200 border-solid p-2 backdrop-blur-sm">
            {branding.brandingEnabled && branding.brandingLogo ? (
              <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6 p-2" />
            ) : (
              <TemplateImage assetBaseUrl={assetBaseUrl} className="mb-4 h-6 p-2" staticAsset="logo.png" />
            )}

            <Section>
              <TemplateImage className="mx-auto" assetBaseUrl={assetBaseUrl} staticAsset="delete-team.png" />
            </Section>

            <Section className="p-2 text-slate-500">
              <Text className="text-center font-medium text-black text-lg">{_(title)}</Text>

              <Text className="my-1 text-center text-base">{_(description)}</Text>

              <div className="mx-auto my-2 w-fit rounded-lg bg-gray-50 px-4 py-2 font-medium text-base text-slate-600">
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
