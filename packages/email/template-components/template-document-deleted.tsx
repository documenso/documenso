import config from '@documenso/tailwind-config';

import { Column, Section, Tailwind, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentDeletedProps {
  inviterName: string;
  documentName: string;
  assetBaseUrl: string;
}

export const TemplateDocumentDeleted = ({
  inviterName,
  documentName,
  assetBaseUrl,
}: TemplateDocumentDeletedProps) => {
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
            <Text className="text-base font-semibold text-[#7AC455]">Cancelled!</Text>
          </Column>
        </Section>

        <Text className="text-primary mb-0 text-center text-lg font-semibold">
          “{documentName}” was deleted by {inviterName}
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          You can not sign this document anymore.
        </Text>
      </Section>
    </Tailwind>
  );
};

export default TemplateDocumentDeleted;
