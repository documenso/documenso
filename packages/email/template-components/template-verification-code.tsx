import { Trans } from '@lingui/react/macro';

import { Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export type TemplateVerificationCodeProps = {
  verificationCode: string;
  assetBaseUrl: string;
};

export const TemplateVerificationCode = ({
  verificationCode,
  assetBaseUrl,
}: TemplateVerificationCodeProps) => {
  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section className="flex-row items-center justify-center">
        <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
          <Trans>Your verification code</Trans>
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          <Trans>Please use the code below to verify your identity for document signing.</Trans>
        </Text>

        <Text className="my-6 text-center text-3xl font-bold tracking-widest">
          {verificationCode}
        </Text>

        <Text className="my-1 text-center text-sm text-slate-400">
          <Trans>
            If you did not request this code, you can ignore this email. The code will expire after
            10 minutes.
          </Trans>
        </Text>
      </Section>
    </>
  );
};

export default TemplateVerificationCode;
