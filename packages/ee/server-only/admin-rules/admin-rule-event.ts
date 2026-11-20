import type { TUserAuthMethod } from '@documenso/lib/types/user-auth-method';
import type { DocumentMeta, Envelope, Organisation, OrganisationClaim, Recipient, Team, User } from '@prisma/client';

/**
 * The record shapes the engine needs for each participant in an event. Callers shape their Prisma
 * selects to these so the engine never has to query for what the hook point already loaded.
 */

export type AdminRuleEventUser = Pick<User, 'id' | 'email' | 'name' | 'createdAt' | 'twoFactorEnabled'>;

export type AdminRuleEventOrganisation = Pick<Organisation, 'id' | 'type'> & {
  organisationClaim: Pick<OrganisationClaim, 'originalSubscriptionClaimId'>;
};

export type AdminRuleEventTeam = Pick<Team, 'id' | 'url'> & {
  organisation: AdminRuleEventOrganisation;
};

export type AdminRuleEventEnvelope = Pick<Envelope, 'id' | 'title' | 'source'> & {
  recipients: Pick<Recipient, 'email'>[];
  documentMeta: Pick<DocumentMeta, 'subject' | 'message'> | null;
  team: AdminRuleEventTeam;
};

export type AdminRuleEmailType = 'signing_request' | 'reminder' | 'completed' | 'rejected';

export type AdminRuleEvent =
  | {
      trigger: 'DOCUMENT_SENT';
      envelope: AdminRuleEventEnvelope;
      sender: AdminRuleEventUser;
    }
  | {
      trigger: 'EMAIL_SENT';
      envelope: AdminRuleEventEnvelope;
      sender: AdminRuleEventUser;
      emailType: AdminRuleEmailType;
      recipients: Pick<Recipient, 'email'>[];
    }
  | {
      trigger: 'USER_NAME_CHANGED';
      user: AdminRuleEventUser;
      newName: string;
    }
  | {
      trigger: 'USER_SIGNED_UP';
      /**
       * The account that was just created. Sign-up rules run after creation, so they can flag or
       * disable the account but never block the sign-up itself.
       */
      user: Pick<User, 'id' | 'email' | 'name'>;
      signupMethod: TUserAuthMethod;
    };

/**
 * Who the event is about. Actions attach to these records; `null` when the event has no such
 * participant (e.g. a name change has no organisation or envelope).
 */
export type AdminRuleSubject = {
  userId: number | null;
  organisationId: string | null;
  envelopeId: string | null;
};
