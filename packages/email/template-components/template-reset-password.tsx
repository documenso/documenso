import { Img, Section, Tailwind, Text } from '@react-email/components';

import * as config from '@documenso/tailwind-config';

export interface TemplateResetPasswordProps {
  userName: string;
  userEmail: string;
  assetBaseUrl: string;
}

export const TemplateResetPassword = ({ assetBaseUrl }: TemplateResetPasswordProps) => {
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
      <Section className="mt-4 flex-row items-center justify-center">
        <div className="flex items-center justify-center p-4">
          <Img className="h-42" src={getAssetUrl('/static/document.png')} alt="Documenso" />
        </div>

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
