import { Trans } from '@lingui/react/macro';

import { Column, Img, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentSelfSignedProps {
  documentName: string;
  assetBaseUrl: string;
}

export const TemplateDocumentSelfSigned = ({ documentName, assetBaseUrl }: TemplateDocumentSelfSignedProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section className="flex-row items-center justify-center">
        <Section>
          <Column align="center">
            <Text className="font-semibold text-[#2063B0] text-base">
              <Img src={getAssetUrl('/static/completed.png')} className="-mt-0.5 mr-2 inline h-7 w-7 align-middle" />
              <Trans>Completed</Trans>
            </Text>
          </Column>
        </Section>

        <Text className="mt-6 mb-0 text-center font-semibold text-lg text-primary">
          <Trans>You have signed “{documentName}”</Trans>
        </Text>
      </Section>
    </>
  );
};

export default TemplateDocumentSelfSigned;
