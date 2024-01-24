export type DocumentInviteTextMessageTemplateProps = {
  inviterName?: string;
  inviterEmail?: string;
  documentName?: string;
  signDocumentLink?: string;
};

export const DocumentInviteTextMessageTemplate = ({
  inviterName = 'Lucas Smith',
  documentName = 'Open Source Pledge.pdf',
  signDocumentLink = 'https://documenso.com',
}: DocumentInviteTextMessageTemplateProps) => {
  const previewText = `${inviterName} has invited you to sign ${documentName}. Click the following link to view the document: ${signDocumentLink}`;
  return previewText;
};
