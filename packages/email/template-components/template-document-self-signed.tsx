import { env } from '@documenso/lib/utils/env';
import { Trans } from '@lingui/react/macro';

import { Button, Column, Img, Link, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentSelfSignedProps {
  documentName: string;
  assetBaseUrl: string;
}

export const TemplateDocumentSelfSigned = ({ documentName, assetBaseUrl }: TemplateDocumentSelfSignedProps) => {
  const NEXT_PUBLIC_WEBAPP_URL = env('NEXT_PUBLIC_WEBAPP_URL');

  const signUpUrl = `${NEXT_PUBLIC_WEBAPP_URL ?? 'http://localhost:3000'}/signup`;

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section className="flex-row items-center justify-center">
        <Section>
          <Column align="center">
            <Text className="font-semibold text-[#7AC455] text-base">
              <Img src={getAssetUrl('/static/completed.png')} className="-mt-0.5 mr-2 inline h-7 w-7 align-middle" />
              <Trans>Completed</Trans>
            </Text>
          </Column>
        </Section>

        <Text className="mt-6 mb-0 text-center font-semibold text-lg text-primary">
          <Trans>You have signed “{documentName}”</Trans>
        </Text>

        <Text className="mx-auto mt-1 mb-6 max-w-[80%] text-center text-base text-slate-400">
          <Trans>
            Create a{' '}
            <Link
              href={signUpUrl}
              target="_blank"
              className="whitespace-nowrap text-documenso-700 hover:text-documenso-600"
            >
              free account
            </Link>{' '}
            to access your signed documents at any time.
          </Trans>
        </Text>

        <Section className="mt-8 mb-6 text-center">
          <Button
            href={signUpUrl}
            className="mr-4 rounded-lg border border-slate-200 border-solid px-4 py-2 text-center font-medium text-black text-sm no-underline"
          >
            <Img src={getAssetUrl('/static/user-plus.png')} className="mr-2 mb-0.5 inline h-5 w-5 align-middle" />
            <Trans>Create account</Trans>
          </Button>

          <Button
            className="rounded-lg border border-slate-200 border-solid px-4 py-2 text-center font-medium text-black text-sm no-underline"
            href="https://documenso.com/pricing"
          >
            <Img src={getAssetUrl('/static/review.png')} className="mr-2 mb-0.5 inline h-5 w-5 align-middle" />
            <Trans>View plans</Trans>
          </Button>
        </Section>
      </Section>
    </>
  );
};

export default TemplateDocumentSelfSigned;
