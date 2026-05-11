import { Trans } from '@lingui/react/macro';

import { Button, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export type TemplateConfirmationEmailProps = {
  confirmationLink: string;
  assetBaseUrl: string;
};

export const TemplateConfirmationEmail = ({ confirmationLink, assetBaseUrl }: TemplateConfirmationEmailProps) => {
  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section className="flex-row items-center justify-center">
        <Text className="mx-auto mb-0 max-w-[80%] text-center font-semibold text-lg text-primary">
          <Trans>Welcome to Documenso!</Trans>
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          <Trans>Before you get started, please confirm your email address by clicking the button below:</Trans>
        </Text>

        <Section className="mt-8 mb-6 text-center">
          <Button
            className="inline-flex items-center justify-center rounded-lg bg-documenso-500 px-6 py-3 text-center font-medium text-black text-sm no-underline"
            href={confirmationLink}
          >
            <Trans>Confirm email</Trans>
          </Button>
          <Text className="mt-8 text-center text-slate-400 text-sm italic">
            <Trans>
              You can also copy and paste this link into your browser: {confirmationLink} (link expires in 1 hour)
            </Trans>
          </Text>
        </Section>
      </Section>
    </>
  );
};
