import { Button, Img, Section, Tailwind, Text } from '@react-email/components';

import * as config from '@documenso/tailwind-config';

export interface TemplateDocumentCompletedProps {
  downloadLink: string;
  reviewLink: string;
  documentName: string;
  assetBaseUrl: string;
}

export const TemplateDocumentCompleted = ({
  downloadLink,
  reviewLink,
  documentName,
  assetBaseUrl,
}: TemplateDocumentCompletedProps) => {
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

        <Text className="mb-4 flex items-center justify-center text-center text-base font-semibold text-[#7AC455]">
          <Img src={getAssetUrl('/static/completed.png')} className="-mb-0.5 mr-2 inline h-7 w-7" />
          Completed
        </Text>

        <Text className="text-primary mb-0 text-center text-lg font-semibold">
          “{documentName}” was signed by all signers
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          Continue by downloading or reviewing the document.
        </Text>

        <Section className="mb-6 mt-8 text-center">
          <Button
            className="mr-4 inline-flex items-center justify-center rounded-lg border border-solid border-slate-200 px-4 py-2 text-center text-sm font-medium text-black no-underline"
            href={reviewLink}
          >
            <Img src={getAssetUrl('/static/review.png')} className="-mb-1 mr-2 inline h-5 w-5" />
            Review
          </Button>
          <Button
            className="inline-flex items-center justify-center rounded-lg border border-solid border-slate-200 px-4 py-2 text-center text-sm font-medium text-black no-underline"
            href={downloadLink}
          >
            <Img src={getAssetUrl('/static/download.png')} className="-mb-1 mr-2 inline h-5 w-5" />
            Download
          </Button>
        </Section>
      </Section>
    </Tailwind>
  );
};

export default TemplateDocumentCompleted;
