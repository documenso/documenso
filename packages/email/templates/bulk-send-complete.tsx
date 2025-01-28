import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Preview, Section, Text } from '../components';
import { TemplateFooter } from '../template-components/template-footer';

export interface BulkSendCompleteEmailProps {
  userName: string;
  templateName: string;
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  errors: string[];
  assetBaseUrl?: string;
}

export const BulkSendCompleteEmail = ({
  userName,
  templateName,
  totalProcessed,
  successCount,
  failedCount,
  errors,
}: BulkSendCompleteEmailProps) => {
  const { _ } = useLingui();

  return (
    <Html>
      <Head />
      <Preview>{_(msg`Bulk send operation complete for template "${templateName}"`)}</Preview>
      <Body className="mx-auto my-auto bg-white font-sans">
        <Section>
          <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-4 backdrop-blur-sm">
            <Section>
              <Text className="text-sm">
                <Trans>Hi {userName},</Trans>
              </Text>

              <Text className="text-sm">
                <Trans>Your bulk send operation for template "{templateName}" has completed.</Trans>
              </Text>

              <Text className="text-lg font-semibold">
                <Trans>Summary:</Trans>
              </Text>

              <ul className="my-2 ml-4 list-inside list-disc">
                <li>
                  <Trans>Total rows processed: {totalProcessed}</Trans>
                </li>
                <li className="mt-1">
                  <Trans>Successfully created: {successCount}</Trans>
                </li>
                <li className="mt-1">
                  <Trans>Failed: {failedCount}</Trans>
                </li>
              </ul>

              {failedCount > 0 && (
                <Section className="mt-4">
                  <Text className="text-lg font-semibold">
                    <Trans>The following errors occurred:</Trans>
                  </Text>

                  <ul className="my-2 ml-4 list-inside list-disc">
                    {errors.map((error, index) => (
                      <li key={index} className="text-destructive mt-1 text-sm text-slate-400">
                        {error}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Text className="text-sm">
                <Trans>
                  You can view the created documents in your dashboard under the "Documents created
                  from template" section.
                </Trans>
              </Text>
            </Section>
          </Container>

          <Container className="mx-auto max-w-xl">
            <TemplateFooter isDocument={false} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};
