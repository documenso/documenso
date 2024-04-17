<<<<<<< HEAD
import { Button, Section, Tailwind, Text } from '@react-email/components';

import * as config from '@documenso/tailwind-config';

=======
import { env } from 'next-runtime-env';

import { Button, Section, Text } from '../components';
>>>>>>> main
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateResetPasswordProps {
  userName: string;
  userEmail: string;
  assetBaseUrl: string;
}

export const TemplateResetPassword = ({ assetBaseUrl }: TemplateResetPasswordProps) => {
<<<<<<< HEAD
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
=======
  const NEXT_PUBLIC_WEBAPP_URL = env('NEXT_PUBLIC_WEBAPP_URL');

  return (
    <>
>>>>>>> main
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section className="flex-row items-center justify-center">
        <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
          Password updated!
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          Your password has been updated.
        </Text>

        <Section className="mb-6 mt-8 text-center">
          <Button
            className="bg-documenso-500 inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-black no-underline"
<<<<<<< HEAD
            href={`${process.env.NEXT_PUBLIC_WEBAPP_URL ?? 'http://localhost:3000'}/signin`}
=======
            href={`${NEXT_PUBLIC_WEBAPP_URL ?? 'http://localhost:3000'}/signin`}
>>>>>>> main
          >
            Sign In
          </Button>
        </Section>
      </Section>
<<<<<<< HEAD
    </Tailwind>
=======
    </>
>>>>>>> main
  );
};

export default TemplateResetPassword;
