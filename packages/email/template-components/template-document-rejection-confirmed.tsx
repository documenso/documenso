import { Trans } from '@lingui/react/macro';

import { Container, Heading, Section, Text } from '../components';

interface TemplateDocumentRejectionConfirmedProps {
  recipientName: string;
  documentName: string;
  documentOwnerName: string;
  reason?: string;
}

export function TemplateDocumentRejectionConfirmed({
  recipientName,
  documentName,
  documentOwnerName,
  reason,
}: TemplateDocumentRejectionConfirmedProps) {
  return (
    <Container>
      <Section>
        <Heading className="text-2xl font-semibold">
          <Trans>Rejection Confirmed</Trans>
        </Heading>

        <Text className="text-primary text-base">
          <Trans>
            This email confirms that you have rejected the document{' '}
            <strong className="font-bold">"{documentName}"</strong> sent by {documentOwnerName}.
          </Trans>
        </Text>

        {reason && (
          <Text className="text-base font-medium text-slate-400">
            <Trans>Rejection reason: {reason}</Trans>
          </Text>
        )}

        <Text className="text-base">
          <Trans>
            The document owner has been notified of this rejection. No further action is required
            from you at this time. The document owner may contact you with any questions regarding
            this rejection.
          </Trans>
        </Text>
      </Section>
    </Container>
  );
}
