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
        <Text className="text-primary mb-0 mt-6 text-left text-lg font-semibold">
          Your document has been deleted by an admin!
        </Text>

        <Text className="mx-auto mb-6 mt-1 text-left text-base text-slate-400">
          "{documentName}" has been deleted by an admin.
        </Text>

        <Text className="mx-auto mb-6 mt-1 text-left text-base text-slate-400">
          This document can not be recovered, if you would like to dispute the reason for future
          documents please contact support.
        </Text>

        <Text className="mx-auto mt-1 text-left text-base text-slate-400">
          The reason provided for deletion is the following:
        </Text>

        <Text className="mx-auto mb-6 mt-1 text-left text-base italic text-slate-400">
          {reason}
        </Text>
      </Section>
    </>
  );
};

export default TemplateDocumentDelete;
