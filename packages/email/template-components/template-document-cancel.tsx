import { Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentCancelProps {
  inviterName: string;
  inviterEmail: string;
  documentName: string;
  assetBaseUrl: string;
}

export const TemplateDocumentCancel = ({
  inviterName,
  documentName,
  assetBaseUrl,
}: TemplateDocumentCancelProps) => {
  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
          {inviterName} has cancelled the document
          <br />"{documentName}"
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          You don't need to sign it anymore.
        </Text>
      </Section>
    </>
  );
};

export default TemplateDocumentCancel;
