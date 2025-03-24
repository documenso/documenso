import { Trans } from '@lingui/react/macro';

import { Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentCancelProps {
  inviterName: string;
  inviterEmail: string;
  documentName: string;
  assetBaseUrl: string;
  cancellationReason?: string;
}

export const TemplateDocumentCancel = ({
  inviterName,
  documentName,
  assetBaseUrl,
  cancellationReason,
}: TemplateDocumentCancelProps) => {
  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
          <Trans>
            {inviterName} has cancelled the document
            <br />"{documentName}"
          </Trans>
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          <Trans>All signatures have been voided.</Trans>
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          <Trans>You don't need to sign it anymore.</Trans>
        </Text>

        {cancellationReason && (
          <Text className="mt-4 text-center text-base">
            <Trans>Reason for cancellation: {cancellationReason}</Trans>
          </Text>
        )}
      </Section>
    </>
  );
};

export default TemplateDocumentCancel;
