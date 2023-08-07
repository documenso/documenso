import { Img, Section, Tailwind, Text } from '@react-email/components';

import * as config from '@documenso/tailwind-config';

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
      <Section className="flex-row items-center justify-center">
        <div className="flex items-center justify-center p-4">
          <Img className="h-42" src={getAssetUrl('/static/document.png')} alt="Documenso" />
        </div>

        <Text className="mb-4 flex items-center justify-center text-center text-base font-semibold text-blue-500">
          <Img src={getAssetUrl('/static/clock.png')} className="-mb-0.5 mr-2 inline h-7 w-7" />
          Waiting for others
        </Text>

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
