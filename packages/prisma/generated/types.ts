import type { ColumnType } from 'kysely';

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export const IdentityProvider = {
  DOCUMENSO: 'DOCUMENSO',
  GOOGLE: 'GOOGLE',
  OIDC: 'OIDC',
} as const;
export type IdentityProvider = (typeof IdentityProvider)[keyof typeof IdentityProvider];
export const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const UserSecurityAuditLogType = {
  ACCOUNT_PROFILE_UPDATE: 'ACCOUNT_PROFILE_UPDATE',
  ACCOUNT_SSO_LINK: 'ACCOUNT_SSO_LINK',
  AUTH_2FA_DISABLE: 'AUTH_2FA_DISABLE',
  AUTH_2FA_ENABLE: 'AUTH_2FA_ENABLE',
  PASSKEY_CREATED: 'PASSKEY_CREATED',
  PASSKEY_DELETED: 'PASSKEY_DELETED',
  PASSKEY_UPDATED: 'PASSKEY_UPDATED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_UPDATE: 'PASSWORD_UPDATE',
  SIGN_OUT: 'SIGN_OUT',
  SIGN_IN: 'SIGN_IN',
  SIGN_IN_FAIL: 'SIGN_IN_FAIL',
  SIGN_IN_2FA_FAIL: 'SIGN_IN_2FA_FAIL',
  SIGN_IN_PASSKEY_FAIL: 'SIGN_IN_PASSKEY_FAIL',
} as const;
export type UserSecurityAuditLogType =
  (typeof UserSecurityAuditLogType)[keyof typeof UserSecurityAuditLogType];
export const WebhookTriggerEvents = {
  DOCUMENT_CREATED: 'DOCUMENT_CREATED',
  DOCUMENT_SENT: 'DOCUMENT_SENT',
  DOCUMENT_OPENED: 'DOCUMENT_OPENED',
  DOCUMENT_SIGNED: 'DOCUMENT_SIGNED',
  DOCUMENT_COMPLETED: 'DOCUMENT_COMPLETED',
} as const;
export type WebhookTriggerEvents = (typeof WebhookTriggerEvents)[keyof typeof WebhookTriggerEvents];
export const WebhookCallStatus = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;
export type WebhookCallStatus = (typeof WebhookCallStatus)[keyof typeof WebhookCallStatus];
export const ApiTokenAlgorithm = {
  SHA512: 'SHA512',
} as const;
export type ApiTokenAlgorithm = (typeof ApiTokenAlgorithm)[keyof typeof ApiTokenAlgorithm];
export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  INACTIVE: 'INACTIVE',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
export const DocumentStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];
export const DocumentSource = {
  DOCUMENT: 'DOCUMENT',
  TEMPLATE: 'TEMPLATE',
  TEMPLATE_DIRECT_LINK: 'TEMPLATE_DIRECT_LINK',
} as const;
export type DocumentSource = (typeof DocumentSource)[keyof typeof DocumentSource];
export const DocumentDataType = {
  S3_PATH: 'S3_PATH',
  BYTES: 'BYTES',
  BYTES_64: 'BYTES_64',
} as const;
export type DocumentDataType = (typeof DocumentDataType)[keyof typeof DocumentDataType];
export const ReadStatus = {
  NOT_OPENED: 'NOT_OPENED',
  OPENED: 'OPENED',
} as const;
export type ReadStatus = (typeof ReadStatus)[keyof typeof ReadStatus];
export const SendStatus = {
  NOT_SENT: 'NOT_SENT',
  SENT: 'SENT',
} as const;
export type SendStatus = (typeof SendStatus)[keyof typeof SendStatus];
export const SigningStatus = {
  NOT_SIGNED: 'NOT_SIGNED',
  SIGNED: 'SIGNED',
} as const;
export type SigningStatus = (typeof SigningStatus)[keyof typeof SigningStatus];
export const RecipientRole = {
  CC: 'CC',
  SIGNER: 'SIGNER',
  VIEWER: 'VIEWER',
  APPROVER: 'APPROVER',
} as const;
export type RecipientRole = (typeof RecipientRole)[keyof typeof RecipientRole];
export const FieldType = {
  SIGNATURE: 'SIGNATURE',
  FREE_SIGNATURE: 'FREE_SIGNATURE',
  NAME: 'NAME',
  EMAIL: 'EMAIL',
  DATE: 'DATE',
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  RADIO: 'RADIO',
  CHECKBOX: 'CHECKBOX',
  DROPDOWN: 'DROPDOWN',
} as const;
export type FieldType = (typeof FieldType)[keyof typeof FieldType];
export const TeamMemberRole = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
} as const;
export type TeamMemberRole = (typeof TeamMemberRole)[keyof typeof TeamMemberRole];
export const TeamMemberInviteStatus = {
  ACCEPTED: 'ACCEPTED',
  PENDING: 'PENDING',
} as const;
export type TeamMemberInviteStatus =
  (typeof TeamMemberInviteStatus)[keyof typeof TeamMemberInviteStatus];
export const TemplateType = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
} as const;
export type TemplateType = (typeof TemplateType)[keyof typeof TemplateType];
export type Account = {
  id: string;
  userId: number;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  created_at: number | null;
  ext_expires_in: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
};
export type AnonymousVerificationToken = {
  id: string;
  token: string;
  expiresAt: Timestamp;
  createdAt: Generated<Timestamp>;
};
export type ApiToken = {
  id: Generated<number>;
  name: string;
  token: string;
  algorithm: Generated<ApiTokenAlgorithm>;
  expires: Timestamp | null;
  createdAt: Generated<Timestamp>;
  userId: number | null;
  teamId: number | null;
};
export type Document = {
  id: Generated<number>;
  userId: number;
  authOptions: unknown | null;
  formValues: unknown | null;
  title: string;
  status: Generated<DocumentStatus>;
  documentDataId: string;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
  completedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  teamId: number | null;
  templateId: number | null;
  source: DocumentSource;
};
export type DocumentAuditLog = {
  id: string;
  documentId: number;
  createdAt: Generated<Timestamp>;
  type: string;
  data: unknown;
  name: string | null;
  email: string | null;
  userId: number | null;
  userAgent: string | null;
  ipAddress: string | null;
};
export type DocumentData = {
  id: string;
  type: DocumentDataType;
  data: string;
  initialData: string;
};
export type DocumentMeta = {
  id: string;
  subject: string | null;
  message: string | null;
  timezone: Generated<string | null>;
  password: string | null;
  dateFormat: Generated<string | null>;
  documentId: number;
  redirectUrl: string | null;
};
export type DocumentShareLink = {
  id: Generated<number>;
  email: string;
  slug: string;
  documentId: number;
  createdAt: Generated<Timestamp>;
  updatedAt: Timestamp;
};
export type Field = {
  id: Generated<number>;
  secondaryId: string;
  documentId: number | null;
  templateId: number | null;
  recipientId: number;
  type: FieldType;
  page: number;
  positionX: Generated<string>;
  positionY: Generated<string>;
  width: Generated<string>;
  height: Generated<string>;
  customText: string;
  inserted: boolean;
  fieldMeta: unknown | null;
};
export type Passkey = {
  id: string;
  userId: number;
  name: string;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
  lastUsedAt: Timestamp | null;
  credentialId: Buffer;
  credentialPublicKey: Buffer;
  counter: string;
  credentialDeviceType: string;
  credentialBackedUp: boolean;
  transports: string[];
};
export type PasswordResetToken = {
  id: Generated<number>;
  token: string;
  createdAt: Generated<Timestamp>;
  expiry: Timestamp;
  userId: number;
};
export type Recipient = {
  id: Generated<number>;
  documentId: number | null;
  templateId: number | null;
  email: string;
  name: Generated<string>;
  token: string;
  documentDeletedAt: Timestamp | null;
  expired: Timestamp | null;
  signedAt: Timestamp | null;
  authOptions: unknown | null;
  role: Generated<RecipientRole>;
  readStatus: Generated<ReadStatus>;
  signingStatus: Generated<SigningStatus>;
  sendStatus: Generated<SendStatus>;
};
export type Session = {
  id: string;
  sessionToken: string;
  userId: number;
  expires: Timestamp;
};
export type Signature = {
  id: Generated<number>;
  created: Generated<Timestamp>;
  recipientId: number;
  fieldId: number;
  signatureImageAsBase64: string | null;
  typedSignature: string | null;
};
export type SiteSettings = {
  id: string;
  enabled: Generated<boolean>;
  data: unknown;
  lastModifiedByUserId: number | null;
  lastModifiedAt: Generated<Timestamp>;
};
export type Subscription = {
  id: Generated<number>;
  status: Generated<SubscriptionStatus>;
  planId: string;
  priceId: string;
  periodEnd: Timestamp | null;
  userId: number | null;
  teamId: number | null;
  createdAt: Generated<Timestamp>;
  updatedAt: Timestamp;
  cancelAtPeriodEnd: Generated<boolean>;
};
export type Team = {
  id: Generated<number>;
  name: string;
  url: string;
  createdAt: Generated<Timestamp>;
  customerId: string | null;
  ownerUserId: number;
};
export type TeamEmail = {
  teamId: number;
  createdAt: Generated<Timestamp>;
  name: string;
  email: string;
};
export type TeamEmailVerification = {
  teamId: number;
  name: string;
  email: string;
  token: string;
  expiresAt: Timestamp;
  createdAt: Generated<Timestamp>;
};
export type TeamMember = {
  id: Generated<number>;
  teamId: number;
  createdAt: Generated<Timestamp>;
  role: TeamMemberRole;
  userId: number;
};
export type TeamMemberInvite = {
  id: Generated<number>;
  teamId: number;
  createdAt: Generated<Timestamp>;
  email: string;
  status: Generated<TeamMemberInviteStatus>;
  role: TeamMemberRole;
  token: string;
};
export type TeamPending = {
  id: Generated<number>;
  name: string;
  url: string;
  createdAt: Generated<Timestamp>;
  customerId: string;
  ownerUserId: number;
};
export type TeamTransferVerification = {
  teamId: number;
  userId: number;
  name: string;
  email: string;
  token: string;
  expiresAt: Timestamp;
  createdAt: Generated<Timestamp>;
  clearPaymentMethods: Generated<boolean>;
};
export type Template = {
  id: Generated<number>;
  type: Generated<TemplateType>;
  title: string;
  userId: number;
  teamId: number | null;
  authOptions: unknown | null;
  templateDocumentDataId: string;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
};
export type TemplateDirectLink = {
  id: string;
  templateId: number;
  token: string;
  createdAt: Generated<Timestamp>;
  enabled: boolean;
  directTemplateRecipientId: number;
};
export type TemplateMeta = {
  id: string;
  subject: string | null;
  message: string | null;
  timezone: Generated<string | null>;
  password: string | null;
  dateFormat: Generated<string | null>;
  templateId: number;
  redirectUrl: string | null;
};
export type User = {
  id: Generated<number>;
  name: string | null;
  customerId: string | null;
  email: string;
  emailVerified: Timestamp | null;
  password: string | null;
  source: string | null;
  signature: string | null;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
  lastSignedIn: Generated<Timestamp>;
  roles: Generated<Role[]>;
  identityProvider: Generated<IdentityProvider>;
  twoFactorSecret: string | null;
  twoFactorEnabled: Generated<boolean>;
  twoFactorBackupCodes: string | null;
  url: string | null;
};
export type UserProfile = {
  id: number;
  bio: string | null;
};
export type UserSecurityAuditLog = {
  id: Generated<number>;
  userId: number;
  createdAt: Generated<Timestamp>;
  type: UserSecurityAuditLogType;
  userAgent: string | null;
  ipAddress: string | null;
};
export type VerificationToken = {
  id: Generated<number>;
  secondaryId: string;
  identifier: string;
  token: string;
  expires: Timestamp;
  createdAt: Generated<Timestamp>;
  userId: number;
};
export type Webhook = {
  id: string;
  webhookUrl: string;
  eventTriggers: WebhookTriggerEvents[];
  secret: string | null;
  enabled: Generated<boolean>;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
  userId: number;
  teamId: number | null;
};
export type WebhookCall = {
  id: string;
  status: WebhookCallStatus;
  url: string;
  event: WebhookTriggerEvents;
  requestBody: unknown;
  responseCode: number;
  responseHeaders: unknown | null;
  responseBody: unknown | null;
  createdAt: Generated<Timestamp>;
  webhookId: string;
};
export type DB = {
  Account: Account;
  AnonymousVerificationToken: AnonymousVerificationToken;
  ApiToken: ApiToken;
  Document: Document;
  DocumentAuditLog: DocumentAuditLog;
  DocumentData: DocumentData;
  DocumentMeta: DocumentMeta;
  DocumentShareLink: DocumentShareLink;
  Field: Field;
  Passkey: Passkey;
  PasswordResetToken: PasswordResetToken;
  Recipient: Recipient;
  Session: Session;
  Signature: Signature;
  SiteSettings: SiteSettings;
  Subscription: Subscription;
  Team: Team;
  TeamEmail: TeamEmail;
  TeamEmailVerification: TeamEmailVerification;
  TeamMember: TeamMember;
  TeamMemberInvite: TeamMemberInvite;
  TeamPending: TeamPending;
  TeamTransferVerification: TeamTransferVerification;
  Template: Template;
  TemplateDirectLink: TemplateDirectLink;
  TemplateMeta: TemplateMeta;
  User: User;
  UserProfile: UserProfile;
  UserSecurityAuditLog: UserSecurityAuditLog;
  VerificationToken: VerificationToken;
  Webhook: Webhook;
  WebhookCall: WebhookCall;
};
