type DocumentSenderUser = {
  name?: string | null;
  email: string;
};

type DocumentSenderTeam = {
  name?: string | null;
  teamEmail?: { email: string } | null;
};

export type DocumentSender = {
  name: string;
  email: string;
};

type ResolveDocumentSenderOptions = {
  /**
   * The team/organisation setting surfaced in the UI as "Send on Behalf of Team".
   *
   * When enabled the individual sender is disclosed, when disabled it is withheld.
   */
  includeSenderDetails: boolean;
  user: DocumentSenderUser;
  team?: DocumentSenderTeam | null;
};

/**
 * Resolve the identity presented to a recipient as the sender of a document.
 *
 * When `includeSenderDetails` is enabled the individual who sent the document is named,
 * and the caller pairs it with `on behalf of "<team>"`. When it is disabled the individual's
 * name and email are withheld from the recipient and only the team is shown.
 *
 * Mirrors the canonical server-side behaviour in `getEnvelopeForRecipientSigning` and
 * `getEnvelopeForDirectTemplateSigning`, and the preview rendered by the setting itself.
 */
export const resolveDocumentSender = ({
  includeSenderDetails,
  user,
  team,
}: ResolveDocumentSenderOptions): DocumentSender => {
  if (includeSenderDetails) {
    return {
      name: user.name ?? '',
      email: user.email,
    };
  }

  return {
    name: team?.name ?? '',
    email: team?.teamEmail?.email ?? '',
  };
};
