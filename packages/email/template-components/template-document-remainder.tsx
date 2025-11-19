import { Trans } from '@lingui/react/macro';

import { Column, Img, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentReminderProps {
  documentName: string;
  assetBaseUrl: string;
}

export const TemplateDocumentReminder = ({
  documentName,
  assetBaseUrl,
}: TemplateDocumentReminderProps) => {
  const getAssetUrl = (path: string) => new URL(path, assetBaseUrl).toString();

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Section className="mb-4">
          <Column align="center">
            <Text className="text-base font-semibold text-yellow-600">
              <Img
                src={getAssetUrl('/static/reminder.png')}
                className="-mt-0.5 mr-2 inline h-7 w-7 align-middle"
              />
              <Trans>Reminder: Pending signature</Trans>
            </Text>
          </Column>
        </Section>

        <Text className="text-primary mb-0 text-center text-lg font-semibold">
          <Trans>“{documentName}” still needs your signature</Trans>
        </Text>

        <Text className="mx-auto mb-6 mt-1 max-w-[80%] text-center text-base text-slate-400">
          <Trans>
            This is a reminder that your signature is still required.
            <br />
            Please review and sign the document at your earliest convenience.
          </Trans>
        </Text>
      </Section>
    </>
  );
};

export default TemplateDocumentReminder;
