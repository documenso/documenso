export type FontLibraryContext =
  | {
      type: 'personal';
      userId: number;
    }
  | {
      type: 'team';
      userId: number;
      teamId: number;
      organisationId: string;
    }
  | {
      type: 'organisation';
      organisationId: string;
    };

export type FontOwnerSelector =
  | {
      userId: number;
    }
  | {
      teamId: number;
    }
  | {
      organisationId: string;
    };

export const getVisibleFontOwners = (context: FontLibraryContext): FontOwnerSelector[] => {
  if (context.type === 'personal') {
    return [{ userId: context.userId }];
  }

  if (context.type === 'team') {
    return [{ userId: context.userId }, { teamId: context.teamId }, { organisationId: context.organisationId }];
  }

  return [{ organisationId: context.organisationId }];
};
