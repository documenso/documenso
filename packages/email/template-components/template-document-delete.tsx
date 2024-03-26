import { Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentDeleteProps {
  reason: string;
  documentName: string;
  assetBaseUrl: string;
}

export const TemplateDocumentDelete = ({
  reason,
  documentName,
  assetBaseUrl,
}: TemplateDocumentDeleteProps) => {
  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
          This document can not be recovered, if you would like to dispute the reason for future
          documents please contact support.
          <br />"{documentName}"
        </Text>
        <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
          Reason
          <br />"{reason}"
        </Text>
      </Section>
    </>
  );
};

export default TemplateDocumentDelete;
