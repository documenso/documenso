import { Trans } from '@lingui/react/macro';

import { Button, Link, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export type TemplateAdminUserWelcomeProps = {
  resetPasswordLink: string;
  assetBaseUrl: string;
  organisationName: string;
};

export const TemplateAdminUserWelcome = ({
  resetPasswordLink,
  assetBaseUrl,
  organisationName,
}: TemplateAdminUserWelcomeProps) => {
  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section className="flex-row items-center justify-center">
        <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
          <Trans>Welcome to {organisationName}!</Trans>
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          <Trans>
            An administrator has created a Documenso account for you as part of {organisationName}.
          </Trans>
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          <Trans>To get started, please set your password by clicking the button below:</Trans>
        </Text>

        <Section className="mb-6 mt-8 text-center">
          <Button
            className="bg-documenso-500 inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-black no-underline"
            href={resetPasswordLink}
          >
            <Trans>Set Password</Trans>
          </Button>
          <Text className="mt-8 text-center text-sm italic text-slate-400">
            <Trans>
              You can also copy and paste this link into your browser: {resetPasswordLink} (link
              expires in 24 hours)
            </Trans>
          </Text>
        </Section>

        <Section className="mt-8">
          <Text className="text-center text-sm text-slate-400">
            <Trans>
              If you didn't expect this account or have any questions, please{' '}
              <Link href="mailto:support@documenso.com" className="text-documenso-500">
                contact support
              </Link>
              .
            </Trans>
          </Text>
        </Section>
      </Section>
    </>
  );
};
