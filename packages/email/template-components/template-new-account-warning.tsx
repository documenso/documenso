import { Trans } from '@lingui/react/macro';

import { Container, Link, Text } from '../components';

export type TemplateNewAccountWarningProps = {
  senderEmail: string;
  reportUrl?: string;
};

export const TemplateNewAccountWarning = ({ senderEmail, reportUrl }: TemplateNewAccountWarningProps) => {
  return (
    <Container className="mx-auto mt-8 max-w-xl rounded-lg border border-warning border-l-4 border-solid bg-[#fdfae6] px-4 py-3">
      <Text className="my-0 font-semibold text-foreground text-sm">
        <Trans>Warning: This was sent from a new account ({senderEmail})</Trans>
      </Text>

      <Text className="mt-1 mb-0 text-muted-foreground text-sm">
        {reportUrl ? (
          <Trans>
            Only sign if you know and were expecting this sender.{' '}
            <Link className="text-foreground underline" href={reportUrl}>
              Report sender
            </Link>
          </Trans>
        ) : (
          <Trans>Only sign if you know and were expecting this sender.</Trans>
        )}
      </Text>
    </Container>
  );
};
