import { Trans } from '@lingui/react/macro';

import { Button, Column, Img, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentCompletedProps {
  downloadLink: string;
  documentName: string;
  assetBaseUrl: string;
  customBody?: string;
}

export const TemplateDocumentCompleted = ({
  downloadLink,
  documentName,
  assetBaseUrl,
  customBody,
}: TemplateDocumentCompletedProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Section className="mb-4">
          <Column align="center">
            <Text className="font-semibold text-[#7AC455] text-base">
              <Img src={getAssetUrl('/static/completed.png')} className="-mt-0.5 mr-2 inline h-7 w-7 align-middle" />
              <Trans>Completed</Trans>
            </Text>
          </Column>
        </Section>

        <Text className="mb-0 text-center font-semibold text-lg text-primary">
          {customBody || <Trans>“{documentName}” was signed by all signers</Trans>}
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          <Trans>Continue by downloading the document.</Trans>
        </Text>

        <Section className="mt-8 mb-6 text-center">
          <Button
            className="rounded-lg border border-slate-200 border-solid px-4 py-2 text-center font-medium text-black text-sm no-underline"
            href={downloadLink}
          >
            <Img src={getAssetUrl('/static/download.png')} className="mr-2 mb-0.5 inline h-5 w-5 align-middle" />
            <Trans>Download</Trans>
          </Button>
        </Section>
      </Section>
    </>
  );
};

export default TemplateDocumentCompleted;
