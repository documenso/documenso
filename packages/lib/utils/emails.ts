import type { DocumentMeta, OrganisationEmail, OrganisationGlobalSettings } from '@prisma/client';

type DeriveEmailDetailsOptions = {
  documentMeta?: DocumentMeta | null;
  settings?: Omit<OrganisationGlobalSettings, 'id'>;
  allowedEmails: OrganisationEmail[];
};

/**
 * Finds the email details to use.
 *
 * Priority (highest first):
 * 1. Document meta
 * 2. Organisation/Team settings
 * 3. Default Documenso emails
 */
// export const extractDerivedEmailSettings = ({
//   documentMeta,
//   settings,
//   allowedEmails,
// }: DeriveEmailDetailsOptions) => {
//   // 4. Default Documenso emails
//   let fromName = env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Documenso';
//   let fromAddress = env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@documenso.com';

//   // 2. Settings
//   if (settings?.fromEmail) {
//     fromName = settings.fromEmail;
//     fromAddress = settings.fromEmail;
//   }

//   // 1. Document meta
//   if (documentMeta?.emailSettings?.fromEmail) {
//     fromName = documentMeta.emailSettings.fromEmail;
//     fromAddress = documentMeta.emailSettings.fromEmail;
//   }

//   // Validate email is allowed
//   // Todo: emails default instead of error.
//   if (!allowedEmails.some((email) => email.email === fromAddress)) {
//     throw new AppError(AppErrorCode.NOT_FOUND, {
//       message: 'From email not found',
//     });
//   }

//   return {
//     from: {
//       name: fromName,
//       address: fromAddress,
//     },
//   };
// };

export const generateDkimRecord = (
  domain: string,
  selector: string,
  publicKeyFlattened: string,
) => {
  return {
    name: `${selector}._domainkey.${domain}`,
    value: `v=DKIM1; k=rsa; p=${publicKeyFlattened}`,
    type: 'TXT',
  };
};
