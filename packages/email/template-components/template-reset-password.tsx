import { Section, Tailwind, Text } from '@react-email/components';

import * as config from '@documenso/tailwind-config';

import TemplateDocumentImage from './template-document-image';

export interface TemplateResetPasswordProps {
  userName: string;
  userEmail: string;
  assetBaseUrl: string;
}

export const TemplateResetPassword = ({ assetBaseUrl }: TemplateResetPasswordProps) => {
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
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section className="flex-row items-center justify-center">
        <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
          Password updated!
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          Your password has been updated.
        </Text>
      </Section>
    </Tailwind>
  );
};

export default TemplateResetPassword;
