import { DocumentVisibility, TeamMemberRole } from '@prisma/client';

export const determineDocumentVisibility = (
  globalVisibility: DocumentVisibility | null | undefined,
  userRole: TeamMemberRole,
): DocumentVisibility => {
  if (globalVisibility) {
    return globalVisibility;
  }

  if (userRole === TeamMemberRole.ADMIN) {
    return DocumentVisibility.ADMIN;
  }

  if (userRole === TeamMemberRole.MANAGER) {
    return DocumentVisibility.MANAGER_AND_ABOVE;
  }

  return DocumentVisibility.EVERYONE;
};
