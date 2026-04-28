type PublicAccessTeam = {
  teamGlobalSettings?: {
    allowPublicCompletedDocumentAccess: boolean | null;
  } | null;
  organisation: {
    organisationGlobalSettings: {
      allowPublicCompletedDocumentAccess: boolean;
    };
  };
} | null;

export const isPublicDocumentAccessEnabled = (team: PublicAccessTeam): boolean => {
  if (!team) {
    return true;
  }

  return (
    team.teamGlobalSettings?.allowPublicCompletedDocumentAccess ??
    team.organisation.organisationGlobalSettings.allowPublicCompletedDocumentAccess
  );
};
