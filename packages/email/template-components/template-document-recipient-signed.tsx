import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';

import { Column, Img, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentRecipientSignedProps {
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  recipientRole?: RecipientRole;
  assetBaseUrl: string;
}

export const TemplateDocumentRecipientSigned = ({
  documentName,
  recipientName,
  recipientEmail,
  recipientRole = RecipientRole.SIGNER,
  assetBaseUrl,
}: TemplateDocumentRecipientSignedProps) => {
  const { _ } = useLingui();
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  const recipientReference = recipientName || recipientEmail;
  const actioned = _(RECIPIENT_ROLES_DESCRIPTION[recipientRole].actioned).toLowerCase();
  const progressive = _(RECIPIENT_ROLES_DESCRIPTION[recipientRole].progressiveVerb).toLowerCase();

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Section className="mb-4">
          <Column align="center">
            <Text className="font-semibold text-base text-foreground">
              <Img
                src={getAssetUrl('/static/completed.png')}
                className="-mt-0.5 mr-2 inline h-7 w-7 align-middle"
                alt=""
              />
              <Trans>Completed</Trans>
            </Text>
          </Column>
        </Section>

        <Text className="mb-0 text-center font-semibold text-foreground text-lg">
          <Trans>
            {recipientReference} has {actioned} "{documentName}"
          </Trans>
        </Text>

        <Text className="mx-auto mt-1 mb-6 max-w-[80%] text-center text-base text-muted-foreground">
          <Trans>
            {recipientReference} has completed {progressive} the document.
          </Trans>
        </Text>
      </Section>
    </>
  );
};

export default TemplateDocumentRecipientSigned;
