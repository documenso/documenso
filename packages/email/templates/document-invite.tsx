import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { RecipientRole } from '@prisma/client';
import { OrganisationType } from '@prisma/client';

import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import { TemplateCustomMessageBody } from '../template-components/template-custom-message-body';
import type { TemplateDocumentInviteProps } from '../template-components/template-document-invite';
import { TemplateDocumentInvite } from '../template-components/template-document-invite';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentInviteEmailTemplateProps = Partial<TemplateDocumentInviteProps> & {
  customBody?: string;
  role: RecipientRole;
  selfSigner?: boolean;
  teamName?: string;
  teamEmail?: string;
  includeSenderDetails?: boolean;
  organisationType?: OrganisationType;
  reportUrl?: string;
};

export const DocumentInviteEmailTemplate = ({
  inviterName = 'Lucas Smith',
  inviterEmail = 'lucas@documenso.com',
  documentName = 'Open Source Pledge.pdf',
  signDocumentLink = 'https://documenso.com',
  assetBaseUrl = 'http://localhost:3002',
  customBody,
  role,
  selfSigner = false,
  teamName = '',
  includeSenderDetails,
  organisationType,
  reportUrl,
}: DocumentInviteEmailTemplateProps) => {
  const { _ } = useLingui();

  const action = _(RECIPIENT_ROLES_DESCRIPTION[role].actionVerb).toLowerCase();

  let previewText = msg`${inviterName} has invited you to ${action} ${documentName}`;

  if (organisationType === OrganisationType.ORGANISATION) {
    previewText = includeSenderDetails
      ? msg`${inviterName} on behalf of "${teamName}" has invited you to ${action} ${documentName}`
      : msg`${teamName} has invited you to ${action} ${documentName}`;
  }

  if (selfSigner) {
    previewText = msg`Please ${action} your document ${documentName}`;
  }

  return (
    <Html>
      <Head />

      <Body className="mx-auto my-auto bg-background font-sans">
        <Preview>{_(previewText)}</Preview>

        <Section>
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-4 backdrop-blur-sm">
            <Section>
              <TemplateBrandingLogo assetBaseUrl={assetBaseUrl} className="mb-4 h-6" />

              <TemplateDocumentInvite
                inviterName={inviterName}
                inviterEmail={inviterEmail}
                documentName={documentName}
                signDocumentLink={signDocumentLink}
                assetBaseUrl={assetBaseUrl}
                role={role}
                selfSigner={selfSigner}
                organisationType={organisationType}
                teamName={teamName}
                includeSenderDetails={includeSenderDetails}
              />
            </Section>
          </Container>

          <Container className="mx-auto mt-12 max-w-xl">
            <Section>
              {organisationType === OrganisationType.PERSONAL && (
                <Text className="my-4 font-semibold text-base">
                  <Trans>
                    {inviterName}{' '}
                    <Link className="font-normal text-muted-foreground" href={`mailto:${inviterEmail}`}>
                      ({inviterEmail})
                    </Link>
                  </Trans>
                </Text>
              )}

              <Text className="mt-2 text-base text-muted-foreground">
                {customBody ? (
                  <TemplateCustomMessageBody text={customBody} />
                ) : (
                  <Trans>
                    {inviterName} has invited you to {action} the document "{documentName}".
                  </Trans>
                )}
              </Text>
            </Section>
          </Container>

          <Hr className="mx-auto mt-12 max-w-xl" />

          <Container className="mx-auto max-w-xl">
            <TemplateFooter reportUrl={reportUrl} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default DocumentInviteEmailTemplate;
