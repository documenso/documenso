import { Column, Img, Section, Tailwind, Text } from '@react-email/components';

import * as config from '@documenso/tailwind-config';

import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentPendingProps {
  documentName: string;
  assetBaseUrl: string;
}

export const TemplateDocumentPending = ({
  documentName,
  assetBaseUrl,
}: TemplateDocumentPendingProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: config.theme.extend.colors,
          },
        },
      }}
    >
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Section className="mb-4">
          <Column align="center">
            <Text className="text-base font-semibold text-blue-500">
              <Img
                src={getAssetUrl('/static/clock.png')}
                className="-mt-0.5 mr-2 inline h-7 w-7 align-middle"
              />
              Waiting for others
            </Text>
          </Column>
        </Section>

        <Text className="text-primary mb-0 text-center text-lg font-semibold">
          “{documentName}” has been signed
        </Text>

        <Text className="mx-auto mb-6 mt-1 max-w-[80%] text-center text-base text-slate-400">
          We're still waiting for other signers to sign this document.
          <br />
          We'll notify you as soon as it's ready.
        </Text>
      </Section>
    </Tailwind>
  );
};

export default TemplateDocumentPending;
